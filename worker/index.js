// Vikendica Meri — API Worker.
//
// The site is still static assets; this script only owns the paths listed in
// `run_worker_first` in wrangler.jsonc (/api/*, /manager*). Everything else
// falls through to env.ASSETS untouched, so the public pages, the 404 handling
// and the cache headers behave exactly as they did before this file existed.
import { verifyAccess } from './access.js';

/* ---------------------------------------------------------------- helpers -- */

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

const nowIso = () => new Date().toISOString();
const todayYmd = () => new Date().toISOString().slice(0, 10);

const YMD = /^\d{4}-\d{2}-\d{2}$/;
// Deliberately loose. Bouncing a guest's real address over a clever regex costs
// more than accepting one that turns out to be undeliverable.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** ISO date string `n` days from today. */
function ymdOffset(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isValidYmd(s) {
  if (!YMD.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const trim = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/* -------------------------------------------------------------- validation -- */

const LIMITS = { name: 120, email: 160, phone: 40, message: 2000 };
const MAX_BODY_BYTES = 16 * 1024;

/**
 * Validate a public booking request.
 * Returns { data } or { error } — never throws on bad input.
 */
function validateRequest(body) {
  const name = trim(body.name, LIMITS.name);
  const email = trim(body.email, LIMITS.email);
  const phone = trim(body.phone, LIMITS.phone);
  const message = trim(body.message, LIMITS.message);

  if (name.length < 2) return { error: 'name' };
  if (!EMAIL.test(email)) return { error: 'email' };

  // Dates are optional — the form does not require them, so a general enquiry
  // with no dates is legitimate. But half a range is not.
  let checkin = trim(body.checkin, 10) || null;
  let checkout = trim(body.checkout, 10) || null;
  if ((checkin && !checkout) || (!checkin && checkout)) return { error: 'dates_incomplete' };
  if (checkin) {
    if (!isValidYmd(checkin) || !isValidYmd(checkout)) return { error: 'dates_invalid' };
    if (checkout <= checkin) return { error: 'dates_order' };
    // Yesterday, not today: a guest in a timezone behind UTC can legitimately
    // still be on "today" when the Worker has ticked over.
    if (checkin < ymdOffset(-1)) return { error: 'dates_past' };
    if (checkin > ymdOffset(730)) return { error: 'dates_far' };
  }

  let guests = Number.parseInt(body.guests, 10);
  if (!Number.isFinite(guests) || guests < 1 || guests > 10) guests = null;

  return { data: { name, email, phone: phone || null, checkin, checkout, guests, message: message || null } };
}

/* ------------------------------------------------------------- protections -- */

const RATE_WINDOW_MIN = 60;
const RATE_MAX = 5;

async function overRateLimit(env, ip) {
  // Cloudflare always sets CF-Connecting-IP in production, but "no IP means no
  // limit" is the wrong way for that assumption to fail. Unattributable requests
  // share one bucket instead of escaping the limiter entirely.
  const key = ip || 'unknown';
  const since = new Date(Date.now() - RATE_WINDOW_MIN * 60_000).toISOString();
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM requests WHERE client_ip = ? AND created_at > ?'
  )
    .bind(key, since)
    .first();
  return (row?.n ?? 0) >= RATE_MAX;
}

/**
 * Cloudflare Turnstile, enforced only when a secret is configured.
 *
 * The form currently ships hCaptcha's public *test* sitekey, which always
 * passes — so today there is effectively no captcha. Rather than hard-require a
 * secret that does not exist yet and break the form, this enforces the check as
 * soon as TURNSTILE_SECRET is set and stays out of the way until then.
 */
async function turnstileOk(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const out = await res.json();
    return out.success === true;
  } catch {
    // A Turnstile outage must not swallow a real booking enquiry; the rate limit
    // and validation still apply.
    return true;
  }
}

/**
 * Local development only.
 *
 * Access JWTs are signed by Cloudflare, so there is no way to mint one against
 * `wrangler dev` and therefore no way to exercise the panel locally. This opens
 * that door on two conditions that cannot both hold in production: the request
 * must arrive on localhost, and ACCESS_DEV_BYPASS must be set — which only ever
 * happens through `.dev.vars`, a gitignored file that is never uploaded.
 */
function isLocalDevBypass(request, env) {
  if (env.ACCESS_DEV_BYPASS !== '1') return false;
  const host = new URL(request.url).hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

async function requireOwner(request, env) {
  if (isLocalDevBypass(request, env)) return null;
  let result;
  try {
    result = await verifyAccess(request, env);
  } catch (err) {
    // verifyAccess only throws when the JWKS itself cannot be fetched — a wrong
    // team domain, or Cloudflare's certs endpoint being unavailable. Letting it
    // escape turned every admin request into a 1101 "Worker threw an exception",
    // which says nothing about the cause. Still a refusal, but a legible one.
    return json({ error: 'unavailable', reason: String(err.message || err) }, 503);
  }
  if (result.ok) return null;
  return json({ error: 'unauthorized', reason: result.reason }, 401);
}

/* ------------------------------------------------------------------ routes -- */

/**
 * Public availability. Dates and status only.
 *
 * This endpoint is world-readable and the table behind it holds guest names,
 * emails, phone numbers and messages. Nothing but the three columns below may
 * ever be selected here.
 *
 * `to` is the checkout date and is reported as blocked. That is one night more
 * conservative than the industry norm (where a checkout day can host the next
 * check-in), but it matches what the public calendar already renders and it can
 * only ever refuse a date, never double-book one.
 */
async function getAvailability(env) {
  const { results } = await env.DB.prepare(
    `SELECT checkin AS "from", checkout AS "to", status
       FROM requests
      WHERE status IN ('pending', 'confirmed')
        AND checkin IS NOT NULL
        AND checkout >= ?
      UNION ALL
     SELECT checkin AS "from", checkout AS "to", 'confirmed' AS status
       FROM ical_blocks
      WHERE checkout >= ?
      ORDER BY "from"`
  )
    .bind(todayYmd(), todayYmd())
    .all();

  return json(
    { ranges: results ?? [] },
    200,
    // Short cache: the calendar must reflect a confirmation quickly, but a burst
    // of visitors should not each hit D1.
    { 'Cache-Control': 'public, max-age=60' }
  );
}

async function postRequest(request, env) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  if (!body || typeof body !== 'object') return json({ error: 'bad_json' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || '';

  if (!(await turnstileOk(env, body['cf-turnstile-response'], ip))) {
    return json({ error: 'captcha' }, 403);
  }
  if (await overRateLimit(env, ip)) return json({ error: 'rate_limited' }, 429);

  const { data, error } = validateRequest(body);
  if (error) return json({ error }, 400);

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO requests
       (id, created_at, name, email, phone, checkin, checkout, guests, message, status, source, client_ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'site', ?)`
  )
    .bind(
      id,
      nowIso(),
      data.name,
      data.email,
      data.phone,
      data.checkin,
      data.checkout,
      data.guests,
      data.message,
      ip || 'unknown'
    )
    .run();

  return json({ ok: true, id }, 201);
}

async function listRequests(env) {
  const { results } = await env.DB.prepare(
    `SELECT id, created_at, updated_at, name, email, phone, checkin, checkout,
            guests, message, status, source, owner_note
       FROM requests
      ORDER BY
        CASE status WHEN 'pending' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END,
        COALESCE(checkin, created_at)`
  ).all();
  return json({ requests: results ?? [] }, 200, { 'Cache-Control': 'no-store' });
}

const STATUSES = new Set(['pending', 'confirmed', 'declined', 'cancelled']);

async function updateRequest(request, env, id) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const sets = [];
  const args = [];
  if (body.status !== undefined) {
    if (!STATUSES.has(body.status)) return json({ error: 'bad_status' }, 400);
    sets.push('status = ?');
    args.push(body.status);
  }
  if (body.owner_note !== undefined) {
    sets.push('owner_note = ?');
    args.push(trim(body.owner_note, LIMITS.message) || null);
  }
  if (!sets.length) return json({ error: 'nothing_to_update' }, 400);

  sets.push('updated_at = ?');
  args.push(nowIso(), id);

  const res = await env.DB.prepare(`UPDATE requests SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...args)
    .run();
  if (!res.meta?.changes) return json({ error: 'not_found' }, 404);
  return json({ ok: true });
}

/** Owner-entered block: same table, no guest, confirmed immediately. */
async function createBlock(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const checkin = trim(body.checkin, 10);
  const checkout = trim(body.checkout, 10);
  if (!isValidYmd(checkin) || !isValidYmd(checkout)) return json({ error: 'dates_invalid' }, 400);
  if (checkout <= checkin) return json({ error: 'dates_order' }, 400);

  const label = trim(body.label, LIMITS.name) || 'Blokirano';
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO requests
       (id, created_at, name, email, checkin, checkout, status, source, owner_note)
     VALUES (?, ?, ?, '', ?, ?, 'confirmed', 'manual', ?)`
  )
    .bind(id, nowIso(), label, checkin, checkout, trim(body.note, LIMITS.message) || null)
    .run();

  return json({ ok: true, id }, 201);
}

/* ------------------------------------------------------------------- entry -- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // /manager is a real static asset; the Worker only sees it because
    // run_worker_first routes it here so Access is applied before the page is
    // served. Hand it back to the asset router once the caller is verified.
    if (pathname === '/manager' || pathname.startsWith('/manager/')) {
      const denied = await requireOwner(request, env);
      if (denied) return denied;
      return env.ASSETS.fetch(request);
    }

    if (pathname === '/api/availability' && request.method === 'GET') {
      return getAvailability(env);
    }
    if (pathname === '/api/requests' && request.method === 'POST') {
      return postRequest(request, env);
    }

    if (pathname.startsWith('/api/admin/')) {
      const denied = await requireOwner(request, env);
      if (denied) return denied;

      if (pathname === '/api/admin/requests' && request.method === 'GET') {
        return listRequests(env);
      }
      if (pathname === '/api/admin/block' && request.method === 'POST') {
        return createBlock(request, env);
      }
      const match = pathname.match(/^\/api\/admin\/requests\/([0-9a-f-]{36})$/);
      if (match && request.method === 'POST') {
        return updateRequest(request, env, match[1]);
      }
      return json({ error: 'not_found' }, 404);
    }

    if (pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);

    return env.ASSETS.fetch(request);
  },
};
