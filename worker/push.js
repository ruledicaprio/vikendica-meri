// Web Push to the owner's phones.
//
// The manager panel can be added to a phone's home screen and subscribe to push
// notifications (see public/manager/sw.js). This file sends them: an encrypted
// payload (RFC 8291, "aes128gcm") signed with a VAPID key (RFC 8292), using Web
// Crypto only — no dependency, same as worker/access.js.
//
// One secret drives it: VAPID_PRIVATE_JWK, an EC P-256 private key as a JWK
// (`npm run vapid` prints one). Its x/y half is the public key the browsers
// subscribe with, so there is no separate public variable to keep in step.
// While the secret is unset, push is simply off: nothing is sent and the panel
// says so.

// Who to contact about this sender, as push services require. The site URL
// rather than an email address, so no address sits in a public repo.
const VAPID_SUBJECT = 'https://vikendica-meri.iot-pages.workers.dev';

const enc = new TextEncoder();

function b64uToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64u(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** The private JWK from the secret, or null when push is not configured. */
function vapidJwk(env) {
  if (!env.VAPID_PRIVATE_JWK) return null;
  try {
    const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
    return jwk.kty === 'EC' && jwk.crv === 'P-256' && jwk.d && jwk.x && jwk.y ? jwk : null;
  } catch {
    return null;
  }
}

/** Uncompressed public key (0x04 ‖ x ‖ y), base64url — what the browser subscribes with. */
export function vapidPublicKey(env) {
  const jwk = vapidJwk(env);
  return jwk ? bytesToB64u(concat(new Uint8Array([4]), b64uToBytes(jwk.x), b64uToBytes(jwk.y))) : null;
}

/** Authorization header for one push service (RFC 8292). */
async function vapidHeader(endpoint, jwk) {
  const header = bytesToB64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = bytesToB64u(
    enc.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        // Push services cap this at 24 h; 12 h leaves room for clock skew.
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: VAPID_SUBJECT,
      })
    )
  );
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: jwk.d, x: jwk.x, y: jwk.y, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  // Web Crypto returns ECDSA signatures as raw r ‖ s, which is exactly JWS form.
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`))
  );
  const pub = concat(new Uint8Array([4]), b64uToBytes(jwk.x), b64uToBytes(jwk.y));
  return `vapid t=${header}.${claims}.${bytesToB64u(sig)}, k=${bytesToB64u(pub)}`;
}

async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8)
  );
}

/**
 * Encrypt `plaintext` for one subscription (RFC 8291 over RFC 8188, single
 * record). Exported for the round-trip test; `ephemeral` and `salt` are only
 * passed in by that test.
 */
export async function encryptPayload(plaintext, p256dh, auth, { ephemeral, salt } = {}) {
  const uaPublic = b64uToBytes(p256dh);
  const authSecret = b64uToBytes(auth);

  const as =
    ephemeral ||
    (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']));
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256)
  );

  // RFC 8291 §3.3–3.4: mix in the subscription's auth secret, then derive the
  // content key and nonce from a fresh salt.
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const s = salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(s, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(s, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  // One record, so it carries the "last record" delimiter 0x02 and no padding.
  const record = concat(plaintext, new Uint8Array([2]));
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, record));

  // RFC 8188 header: salt ‖ record size (uint32 BE) ‖ key id length ‖ key id.
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(s, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

/** Send one notification. Returns the push service's HTTP status. */
async function sendOne(env, jwk, sub, message) {
  const body = await encryptPayload(enc.encode(JSON.stringify(message)), sub.p256dh, sub.auth);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(sub.endpoint, jwk),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      // A booking enquiry is still worth delivering a day later, and should
      // wake the phone rather than wait for it.
      TTL: '86400',
      Urgency: 'high',
    },
    body,
  });
  return res.status;
}

/**
 * Notify every subscribed phone. Never throws: the caller runs this through
 * waitUntil after the enquiry is stored, and a push problem must not touch the
 * guest's submission. Subscriptions the push service says are gone (404/410 —
 * app removed, permission revoked) are deleted.
 */
export async function notifyPhones(env, message) {
  const jwk = vapidJwk(env);
  if (!jwk) return;
  let subs;
  try {
    ({ results: subs } = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions').all());
  } catch (err) {
    // Most likely the table has not been created yet (migrations/0003_push.sql).
    console.warn('push: subscriptions unavailable:', err?.message ?? err);
    return;
  }
  await Promise.all(
    (subs || []).map(async (sub) => {
      try {
        const status = await sendOne(env, jwk, sub, message);
        if (status === 404 || status === 410) {
          await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
        } else if (status >= 400) {
          // Status only: the endpoint URL identifies a device.
          console.warn('push: rejected', status);
        }
      } catch (err) {
        console.warn('push: failed', err?.message ?? err);
      }
    })
  );
}

/* ------------------------------------------------------- admin endpoints -- */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const PUSH_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|push\.apple\.com|mozilla\.com|mozaws\.net|windows\.com|notify\.windows\.com)\//;

/** Validate a PushSubscription.toJSON() body. */
function parseSubscription(body) {
  const endpoint = String(body?.endpoint || '');
  const p256dh = String(body?.keys?.p256dh || '');
  const auth = String(body?.keys?.auth || '');
  // Only real push services: the worker POSTs to this URL, so it must not be
  // a way to make it call arbitrary hosts.
  if (!PUSH_HOSTS.test(endpoint) || endpoint.length > 1000) return null;
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) return null;
  return { endpoint, p256dh, auth };
}

/**
 * /api/admin/push/* — already behind requireOwner in index.js.
 *   GET  key          → { key } or 503 when VAPID_PRIVATE_JWK is unset
 *   POST subscribe    → store this phone
 *   POST unsubscribe  → forget this phone
 *   POST test         → send a test notification to this phone only
 */
export async function handlePushAdmin(request, env, pathname) {
  const key = vapidPublicKey(env);
  if (!key) return json({ error: 'push_not_configured' }, 503);
  if (pathname === '/api/admin/push/key' && request.method === 'GET') return json({ key });

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const sub = parseSubscription(body);
  if (!sub) return json({ error: 'bad_subscription' }, 400);

  try {
    if (pathname === '/api/admin/push/subscribe' && request.method === 'POST') {
      await env.DB.prepare(
        `INSERT INTO push_subscriptions (endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`
      )
        .bind(sub.endpoint, sub.p256dh, sub.auth, new Date().toISOString())
        .run();
      return json({ ok: true }, 201);
    }
    if (pathname === '/api/admin/push/unsubscribe' && request.method === 'POST') {
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
      return json({ ok: true });
    }
  } catch (err) {
    return json({ error: 'push_table_missing', reason: String(err?.message || err) }, 503);
  }
  if (pathname === '/api/admin/push/test' && request.method === 'POST') {
    const status = await sendOne(env, vapidJwk(env), sub, {
      title: 'Vikendica Meri',
      body: 'Probna obavijest — obavještenja rade na ovom telefonu.',
      url: '/manager/',
      tag: 'test',
    });
    return json({ ok: status < 400, status }, status < 400 ? 200 : 502);
  }
  return json({ error: 'not_found' }, 404);
}
