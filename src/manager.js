// Manager panel.
//
// Everything here talks to /api/admin/*, which Cloudflare Access protects at the
// edge and worker/access.js verifies again. There is no login code in this file
// on purpose: if the request reaches the API at all, the caller is the owner.
//
// The panel fetches the whole `requests` table in one call and does all
// bucketing, grouping, filtering and summarising in the client. That is a
// deliberate choice for a dataset that is a few hundred rows at most: it keeps
// the API surface at three endpoints, and every derived number below stays
// consistent with the others because they are all computed from one snapshot.
import './manager.css';
import { replyFor } from './reply-templates.js';

const MONTHS = [
  'januar', 'februar', 'mart', 'april', 'maj', 'juni',
  'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar',
];
/** "6. novembra" — the form a date takes in a sentence. */
const MONTHS_GEN = [
  'januara', 'februara', 'marta', 'aprila', 'maja', 'juna',
  'jula', 'augusta', 'septembra', 'oktobra', 'novembra', 'decembra',
];
/** Accusative, for "u petak" / "u subotu". */
const WEEKDAYS_ACC = ['nedjelju', 'ponedjeljak', 'utorak', 'srijedu', 'četvrtak', 'petak', 'subotu'];

/** House times, as the site states them to guests. */
const CHECKIN_TIME = '15:00';
const CHECKOUT_TIME = '10:00';

/** A pending request older than this is called out as waiting too long. */
const STALE_DAYS = 2;
/** Horizon of the "nights booked" tile. */
const HORIZON_DAYS = 30;

const els = {
  status: document.getElementById('status'),
  alert: document.getElementById('alert'),
  summary: document.getElementById('summary'),
  pending: document.getElementById('list-pending'),
  confirmed: document.getElementById('list-confirmed'),
  archive: document.getElementById('list-archive'),
  archiveBox: document.getElementById('archive'),
  archiveQ: document.getElementById('archive-q'),
  archiveChips: document.getElementById('archive-chips'),
  countPending: document.getElementById('count-pending'),
  countConfirmed: document.getElementById('count-confirmed'),
  countArchive: document.getElementById('count-archive'),
};

/* ------------------------------------------------------------------ dates -- */

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// Local, not toISOString(): that is UTC, so between midnight and 02:00 in
// Sarajevo it returned yesterday and the "in the house now" status was a day old.
const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Every date here is a plain YYYY-MM-DD with no time zone. Anchoring at 12:00
// local keeps a DST transition from turning a whole-day difference into 23 or
// 25 hours and rounding to the wrong number of nights.
const at = (ymd) => new Date(`${ymd}T12:00:00`);

function fmtDate(ymd) {
  if (!ymd) return '';
  const d = at(ymd);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}.`;
}

/** Same date without the year — for ranges that already state it. */
function fmtShort(ymd) {
  if (!ymd) return '';
  const d = at(ymd);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

/** "u petak, 6. novembra" */
function fmtDay(ymd) {
  const d = at(ymd);
  return `u ${WEEKDAYS_ACC[d.getDay()]}, ${d.getDate()}. ${MONTHS_GEN[d.getMonth()]}`;
}

function daysBetween(from, to) {
  if (!from || !to) return 0;
  return Math.round((at(to) - at(from)) / 86400000);
}

const nights = (from, to) => daysBetween(from, to);

function addDays(ymd, n) {
  const d = at(ymd);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole days since an ISO timestamp, or null if there isn't a usable one. */
function ageDays(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

const plural = (n, one, few, many) =>
  n === 1 ? one : n >= 2 && n <= 4 ? few : many;

const nightsLabel = (n) => `${n} ${plural(n, 'noć', 'noći', 'noći')}`;
const daysLabel = (n) => `${n} ${plural(n, 'dan', 'dana', 'dana')}`;
const guestsLabel = (n) => `${n} ${plural(n, 'gost', 'gosta', 'gostiju')}`;
/** "danas" / "sutra" / "prekosutra" / "za 13 dana" */
const whenLabel = (n) => (n === 0 ? 'danas' : n === 1 ? 'sutra' : n === 2 ? 'prekosutra' : `za ${daysLabel(n)}`);

function say(text, kind = '') {
  els.status.textContent = text;
  els.status.className = `mgr-status${kind ? ` is-${kind}` : ''}`;
}

/* ------------------------------------------------------------------- data -- */

let all = [];
let loadedOnce = false;

/** View state that must survive the full re-render every action triggers. */
const view = { q: '', chips: new Set() };

async function api(path, options) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  if (res.status === 401) throw new Error('Sesija je istekla — osvježite stranicu i prijavite se ponovo.');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Greška ${res.status}`);
  return body;
}

async function load() {
  const scroll = window.scrollY;
  try {
    const { requests } = await api('/api/admin/requests');
    all = requests;
    render();
    // A tapped phone notification opens /manager/#req-<id>. The browser tried
    // to jump there before the list existed, so do it now, once.
    const target = !loadedOnce && location.hash.startsWith('#req-') && document.querySelector(location.hash);
    loadedOnce = true;
    if (target) {
      target.scrollIntoView({ block: 'start' });
      target.classList.add('is-flash');
      return;
    }
    // Re-rendering replaces whole lists, which can change the page height under
    // the viewport. Put the owner back where they were reading.
    window.scrollTo(0, scroll);
  } catch (err) {
    say(err.message, 'err');
    els.alert.innerHTML = `<div class="mgr-alert is-err">
        <span>${esc(err.message)}</span>
        <button class="mgr-btn mgr-btn--ghost" type="button" id="retry">Pokušaj ponovo</button>
      </div>`;
    document.getElementById('retry')?.addEventListener('click', load);
  }
}

/* -------------------------------------------------------------- summarise -- */

/**
 * Do two rows occupy a common day?
 *
 * Inclusive on both ends, matching /api/availability: a checkout day counts as
 * occupied. Erring towards flagging one extra collision is the right direction
 * for a check whose whole job is to stop a double booking.
 */
const overlaps = (a, b) =>
  Boolean(a.checkin && b.checkin && a.checkin <= b.checkout && a.checkout >= b.checkin);

/**
 * Still waiting for the owner: a pending request, or a general enquiry (no
 * dates) that was "confirmed" before enquiries had their own answer — there is
 * no booking behind it, so it belongs back in the queue, not under Potvrđeno.
 */
const isOpen = (r) => r.status === 'pending' || (r.status === 'confirmed' && !r.checkin);

/** Confirmed ranges a pending request would collide with. */
function conflictsFor(req) {
  if (!req.checkin) return [];
  return all.filter((o) => o.id !== req.id && o.status === 'confirmed' && overlaps(req, o));
}

/**
 * Everything the summary strip and the conflict banner display.
 *
 * Pure: takes the rows and today's date, reads no DOM and no module state, so
 * it can be exercised against a fixture array from the console.
 */
export function summarise(list, today) {
  const pendingRows = list.filter(isOpen);
  const confirmed = list.filter((r) => r.status === 'confirmed' && r.checkin);

  const conflictRows = pendingRows.filter((r) =>
    confirmed.some((o) => o.id !== r.id && overlaps(r, o))
  );

  // Who sleeps in the house tonight (arrived on or before today, leaves after
  // it), who leaves today, and the next guests after today. Manual blocks are
  // included throughout: the owner enters phone and Viber bookings that way,
  // with the guest's name as the label.
  const inHouse = confirmed.find((r) => r.checkin <= today && r.checkout > today) || null;
  const leavingToday = confirmed.find((r) => r.checkout === today) || null;
  const upcoming = confirmed
    .filter((r) => r.checkin > today)
    .sort((a, b) => a.checkin.localeCompare(b.checkin));

  // Nights occupied in the next 30 days, each stay clipped to the window so a
  // long booking that starts inside it does not overstate the total.
  const horizon = addDays(today, HORIZON_DAYS);
  let nights30 = 0;
  for (const r of confirmed) {
    const from = r.checkin > today ? r.checkin : today;
    const to = r.checkout < horizon ? r.checkout : horizon;
    if (to > from) nights30 += daysBetween(from, to);
  }

  const ages = pendingRows.map((r) => ageDays(r.created_at)).filter((n) => n !== null);

  return {
    pending: pendingRows.length,
    conflicts: conflictRows.length,
    conflictRows,
    nextArrival: upcoming[0] || null,
    daysToArrival: upcoming[0] ? daysBetween(today, upcoming[0].checkin) : null,
    inHouse,
    leavingToday,
    nights30,
    oldestPendingDays: ages.length ? Math.max(...ages) : null,
  };
}

/**
 * A typed phone number as +<country><number>, for tel:, Viber and WhatsApp.
 *   "+387 61 833 834" → +38761833834
 *   "00385 98 …"      → +38598…
 *   "061 833 834"     → +38761833834   (short 0… is a local BiH number)
 *   "0385912345678"   → +385912345678  (long 0… is 00<country> missing a zero)
 */
function intlPhone(phone) {
  const raw = String(phone || '').trim();
  const d = raw.replace(/\D/g, '');
  if (!d) return '';
  if (raw.startsWith('+')) return `+${d}`;
  if (d.startsWith('00')) return `+${d.slice(2)}`;
  if (d.startsWith('0')) return d.length >= 11 ? `+${d.slice(1)}` : `+387${d.slice(1)}`;
  return `+${d}`;
}
const viberHref = (phone) => `viber://chat?number=${encodeURIComponent(intlPhone(phone))}`;
const waHref = (phone) => `https://wa.me/${intlPhone(phone).slice(1)}`;

/** Viber (the owner's app, so first) and call buttons for a guest, or mail when there is no phone. */
function contactHtml(r) {
  if (r.phone) {
    return `<div class="mgr-today__actions">
        <a class="mgr-btn mgr-btn--viber" href="${esc(viberHref(r.phone))}">💬 Viber</a>
        <a class="mgr-btn mgr-btn--call" href="tel:${esc(intlPhone(r.phone))}">📞 Nazovi</a>
      </div>`;
  }
  if (r.email) {
    return `<div class="mgr-today__actions">
        <a class="mgr-btn mgr-btn--call" href="mailto:${esc(r.email)}">✉️ Pošalji mail</a>
      </div>`;
  }
  return '';
}

function stayLine(r) {
  return [nightsLabel(nights(r.checkin, r.checkout)), r.guests ? guestsLabel(Number(r.guests)) : '']
    .filter(Boolean)
    .join(' · ');
}

/**
 * The top of the panel, written to be read at a glance on a phone: who is in
 * the house now, who comes next, and whether anything is waiting for an answer.
 */
function renderSummary(s, today) {
  // ── now ──
  let now;
  const h = s.inHouse;
  // On checkout morning the departing guests are still in the house until
  // CHECKOUT_TIME; only after that is it free (or the next guests' turn).
  const clock = new Date();
  const hhmm = `${String(clock.getHours()).padStart(2, '0')}:${String(clock.getMinutes()).padStart(2, '0')}`;
  const stillLeaving = !h && s.leavingToday && hhmm < CHECKOUT_TIME ? s.leavingToday : null;
  if (stillLeaving) {
    const title = stillLeaving.name;
    now = `<article class="mgr-card is-busy">
        <p class="mgr-card__kicker">Trenutno · kuća je zauzeta</p>
        <p class="mgr-card__title">${esc(title)}</p>
        <p class="mgr-card__line"><strong>Odlaze danas</strong> do ${CHECKOUT_TIME}</p>
        <p class="mgr-card__line">Večeras je kuća slobodna.</p>
        ${contactHtml(stillLeaving)}
      </article>`;
  } else if (h) {
    const left = daysBetween(today, h.checkout);
    const title = h.name;
    const lines = [
      h.checkin === today
        ? `<strong>Dolaze danas</strong> od ${CHECKIN_TIME}`
        : `Stigli su ${esc(fmtDay(h.checkin))}`,
      `Odlaze <strong>${esc(fmtDay(h.checkout))}</strong> do ${CHECKOUT_TIME}`,
      `Još ${esc(nightsLabel(left))}${h.guests ? ` · ${esc(guestsLabel(Number(h.guests)))}` : ''}`,
    ];
    now = `<article class="mgr-card is-busy">
        <p class="mgr-card__kicker">Trenutno · kuća je zauzeta</p>
        <p class="mgr-card__title">${esc(title)}</p>
        ${lines.map((l) => `<p class="mgr-card__line">${l}</p>`).join('')}
        ${contactHtml(h)}
      </article>`;
  } else {
    now = `<article class="mgr-card is-free">
        <p class="mgr-card__kicker">Trenutno</p>
        <p class="mgr-card__title">Kuća je slobodna</p>
        <p class="mgr-card__line">Večeras nema gostiju.</p>
      </article>`;
  }
  // Same-day turnover: the guests leaving this morning are worth a line of
  // their own, whatever else is going on.
  const leaving =
    s.leavingToday && s.leavingToday !== h && !stillLeaving
      ? `<p class="mgr-card__note">${hhmm < CHECKOUT_TIME ? `Danas odlaze do ${CHECKOUT_TIME}` : 'Danas su otišli'}: <strong>${esc(s.leavingToday.name)}</strong></p>`
      : '';

  // ── next ──
  const n = s.nextArrival;
  const next = n
    ? `<article class="mgr-card is-next">
        <p class="mgr-card__kicker">Sljedeći dolazak · ${esc(whenLabel(s.daysToArrival))}</p>
        <p class="mgr-card__title">${esc(n.name)}</p>
        <p class="mgr-card__line">Dolaze <strong>${esc(fmtDay(n.checkin))}</strong> od ${CHECKIN_TIME}</p>
        <p class="mgr-card__line">Odlaze ${esc(fmtDay(n.checkout))} · ${esc(stayLine(n))}</p>
        ${contactHtml(n)}
      </article>`
    : `<article class="mgr-card">
        <p class="mgr-card__kicker">Sljedeći dolazak</p>
        <p class="mgr-card__title">Nema potvrđenih gostiju</p>
      </article>`;

  // ── the rest, one line each ──
  const waiting = s.pending
    ? `<a class="mgr-line ${s.conflicts ? 'is-red' : 'is-brown'}" href="#pending">
        <span><strong>${s.pending}</strong> ${s.pending === 1 ? 'zahtjev čeka' : s.pending <= 4 ? 'zahtjeva čekaju' : 'zahtjeva čeka'} odgovor${
          s.oldestPendingDays ? ` · najstariji ${esc(daysLabel(s.oldestPendingDays))}` : ''
        }</span> <span class="mgr-line__go" aria-hidden="true">›</span></a>`
    : `<p class="mgr-line">Svi zahtjevi su odgovoreni.</p>`;
  const busy = `<p class="mgr-line"><span>Zauzeto <strong>${s.nights30}</strong> od ${HORIZON_DAYS} noći u narednih ${HORIZON_DAYS} dana</span></p>`;

  els.summary.innerHTML = `${now}${leaving}${next}${waiting}${busy}`;
}

function renderAlert(s) {
  if (!s.conflicts) {
    els.alert.innerHTML = '';
    return;
  }
  const links = s.conflictRows
    .map(
      (r) =>
        `<a href="#req-${esc(r.id)}">${esc(r.name)} · ${esc(fmtShort(r.checkin))} → ${esc(fmtShort(r.checkout))}</a>`
    )
    .join('');
  els.alert.innerHTML = `<div class="mgr-alert is-err">
      <span><strong>${s.conflicts === 1 ? 'Jedan zahtjev' : `${s.conflicts} zahtjeva`}</strong> na čekanju se preklapa s već potvrđenim terminom. Potvrda bi napravila dvostruku rezervaciju.</span>
      <span class="mgr-alert__links">${links}</span>
    </div>`;
}

/* ----------------------------------------------------------------- cards -- */

/**
 * Ready-to-send reply links for a decided request.
 *
 * Only for statuses where there is something to tell the guest. 'cancelled' is
 * excluded deliberately: the decline wording says the dates are taken, which is
 * not what happened when the owner cancels a booking they had already accepted.
 * That case needs a real conversation, not a template.
 */
function replyHtml(req) {
  const kind = req.status === 'confirmed' ? 'confirm' : req.status === 'declined' ? 'decline' : null;
  if (!kind) return '';

  const reply = replyFor(req, kind);
  // Null for a general enquiry with no dates — nothing to template.
  if (!reply) return '';
  const { subject, body } = reply;
  const links = [];

  if (req.email) {
    // The '@' must stay literal: RFC 6068 wants an addr-spec, and a %40 here is
    // misparsed by some mail clients. Everything else is still encoded.
    const to = encodeURIComponent(req.email).replace(/%40/g, '@');
    const href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    links.push(`<a class="mgr-btn mgr-btn--reply" href="${esc(href)}">✉️ Odgovori mailom</a>`);
  }
  if (req.phone) {
    // Viber cannot open a chat with the text already typed, so this copies the
    // reply and opens the chat; the owner pastes it (see the click handler).
    links.unshift(
      `<button class="mgr-btn mgr-btn--reply mgr-btn--viber-reply" type="button"
          data-viber="${esc(viberHref(req.phone))}" data-text="${esc(body)}">💬 Odgovori na Viberu</button>`
    );
    // WhatsApp has no subject line, so the greeting has to carry it.
    links.push(
      `<a class="mgr-btn mgr-btn--reply" target="_blank" rel="noopener"
          href="${esc(waHref(req.phone))}?text=${encodeURIComponent(body)}">💬 Odgovori na WhatsApp</a>`
    );
  }
  if (!links.length) return '';

  return `<div class="req__reply">
      <span class="req__reply-label">Poruka gostu (${req.lang === 'en' ? 'EN' : 'BS'}) — uredite prije slanja:</span>
      ${links.join('')}
    </div>`;
}

const STATUS_LABEL = {
  pending: 'na čekanju',
  confirmed: 'potvrđeno',
  declined: 'odbijeno',
  cancelled: 'otkazano',
  answered: 'odgovoreno',
};

/** Reply straight from the card: Viber first (the owner's app), then call and mail. */
function enquiryContactHtml(req) {
  const b = [];
  if (req.phone) {
    b.push(`<a class="mgr-btn mgr-btn--viber" href="${esc(viberHref(req.phone))}">💬 Viber</a>`);
    b.push(`<a class="mgr-btn mgr-btn--call" href="tel:${esc(intlPhone(req.phone))}">📞 Nazovi</a>`);
  }
  if (req.email) {
    b.push(`<a class="mgr-btn mgr-btn--call" href="mailto:${esc(req.email)}?subject=${encodeURIComponent('Vikendica Meri — vaš upit')}">✉️ Mail</a>`);
  }
  return b.length ? `<div class="mgr-today__actions req__contact">${b.join('')}</div>` : '';
}

function noteHtml(req) {
  return `<div class="req__note-row">
      <label class="req__note-label" for="note-${esc(req.id)}">Interna bilješka</label>
      <input class="req__note" id="note-${esc(req.id)}" type="text" data-note="${esc(req.id)}"
             value="${esc(req.owner_note || '')}" placeholder="vidi samo vlasnik" />
      <span class="req__note-state" data-notestate="${esc(req.id)}"></span>
    </div>`;
}

function editHtml(req) {
  return `<form class="req__edit" data-edit="${esc(req.id)}">
      <label>Dolazak <input type="date" name="checkin" value="${esc(req.checkin || '')}" /></label>
      <label>Odlazak <input type="date" name="checkout" value="${esc(req.checkout || '')}" /></label>
      <label>Gostiju <input type="number" name="guests" min="1" max="10" value="${esc(req.guests ?? '')}" /></label>
      <button class="mgr-btn mgr-btn--ghost" type="submit">Sačuvaj izmjene</button>
    </form>`;
}

/**
 * An owner-entered block.
 *
 * Blocks live in the same table as bookings (POST /api/admin/block writes a
 * source:'manual' row), but there is no guest behind one: no contacts, no
 * message, no reply template, nothing to confirm or decline. It used to render
 * through the booking card with those parts switched off one `if` at a time;
 * a separate branch says what it is instead of subtracting what it isn't.
 */
function blockCardHtml(req) {
  const n = nights(req.checkin, req.checkout);
  const active = req.status === 'confirmed';

  return `
    <article class="req req--block" id="req-${esc(req.id)}">
      <div class="req__head">
        <span class="req__dates">${esc(fmtDate(req.checkin))} → ${esc(fmtDate(req.checkout))}</span>
        ${n ? `<span class="req__nights">${esc(nightsLabel(n))}</span>` : ''}
        <span class="req__badge req__badge--manual">blokirano</span>
      </div>
      <p class="req__meta">${esc(req.name)}</p>
      ${req.owner_note ? `<p class="req__msg">${esc(req.owner_note)}</p>` : ''}
      <div class="req__foot">
        ${
          active
            ? `<button class="mgr-btn mgr-btn--no" data-act="cancelled" data-id="${esc(req.id)}">Ukloni blokadu</button>`
            : `<button class="mgr-btn" data-act="confirmed" data-id="${esc(req.id)}">Vrati blokadu</button>`
        }
        <details class="req__more">
          <summary>Uredi</summary>
          <div class="req__more-body">
            ${editHtml(req)}
            ${noteHtml(req)}
          </div>
        </details>
      </div>
    </article>`;
}

function bookingCardHtml(req) {
  const conflicts = req.status === 'pending' ? conflictsFor(req) : [];
  const n = nights(req.checkin, req.checkout);
  // A question with no dates: there is nothing to confirm, only to answer.
  const enquiry = !req.checkin && isOpen(req);
  const age = isOpen(req) ? ageDays(req.created_at) : null;
  const stale = age !== null && age >= STALE_DAYS;
  const dates = req.checkin
    ? `${fmtDate(req.checkin)} → ${fmtDate(req.checkout)}`
    : 'Bez datuma (opći upit)';

  const who = [];
  if (req.email) who.push(`<a href="mailto:${esc(req.email)}">${esc(req.email)}</a>`);
  if (req.phone) {
    who.push(
      `<a href="tel:${esc(intlPhone(req.phone))}">${esc(req.phone)}</a> · ` +
        `<a href="${esc(viberHref(req.phone))}">Viber</a> · ` +
        `<a href="${esc(waHref(req.phone))}" target="_blank" rel="noopener">WhatsApp</a>`
    );
  }
  if (req.guests) who.push(`${esc(req.guests)} gostiju`);

  // One button carries the decision; everything else is a step back from it and
  // lives behind the disclosure, so the card reads as a question with an answer.
  const primary = enquiry
    ? `<button class="mgr-btn mgr-btn--ok" data-act="answered" data-id="${esc(req.id)}">✓ Odgovoreno</button>`
    : req.status === 'pending'
      ? `<button class="mgr-btn mgr-btn--ok" data-act="confirmed" data-id="${esc(req.id)}">Potvrdi</button>`
      : req.status === 'confirmed'
        ? `<button class="mgr-btn mgr-btn--no" data-act="cancelled" data-id="${esc(req.id)}">Otkaži</button>`
        : `<button class="mgr-btn" data-act="pending" data-id="${esc(req.id)}">Vrati na čekanje</button>`;

  const secondary = enquiry
    ? ''
    : req.status === 'pending'
      ? `<button class="mgr-btn mgr-btn--no" data-act="declined" data-id="${esc(req.id)}">Odbij</button>`
      : req.status === 'confirmed'
        ? `<button class="mgr-btn mgr-btn--ghost" data-act="pending" data-id="${esc(req.id)}">Vrati na čekanje</button>`
        : '';

  const meta = [
    esc(req.name),
    `primljeno ${esc((req.created_at || '').slice(0, 10))}`,
    age !== null ? `čeka ${esc(daysLabel(age))}` : '',
    req.updated_at && !isOpen(req)
      ? `odlučeno ${esc(fmtShort(req.updated_at.slice(0, 10)))}`
      : '',
  ].filter(Boolean);

  return `
    <article class="req${conflicts.length ? ' req--conflict' : ''}${stale ? ' is-stale' : ''}" id="req-${esc(req.id)}">
      <div class="req__head">
        <span class="req__dates">${esc(dates)}</span>
        ${n ? `<span class="req__nights">${esc(nightsLabel(n))}</span>` : ''}
        <span class="req__badge">${esc(req.source)}</span>
        ${
          enquiry
            ? '<span class="req__status is-pending">čeka odgovor</span>'
            : `<span class="req__status is-${esc(req.status)}">${esc(STATUS_LABEL[req.status] || req.status)}</span>`
        }
      </div>
      <p class="req__meta">${meta.join(' · ')}</p>
      ${conflicts.length ? `<p class="req__warn">Preklapa se sa ${conflicts.length} potvrđenim terminom. Potvrda bi napravila dvostruku rezervaciju.</p>` : ''}
      ${who.length ? `<p class="req__who">${who.join('')}</p>` : ''}
      ${req.message ? `<p class="req__msg">${esc(req.message)}</p>` : ''}
      ${enquiry ? `<p class="req__hint">Opći upit bez datuma — odgovorite gostu, pa označite „Odgovoreno“. Ako gost javi datume, upišite ih pod „Detalji“.</p>${enquiryContactHtml(req)}` : ''}
      <div class="req__foot">
        ${primary}
        <details class="req__more">
          <summary>Detalji i odgovor</summary>
          <div class="req__more-body">
            ${secondary ? `<div class="req__secondary">${secondary}</div>` : ''}
            ${replyHtml(req)}
            ${editHtml(req)}
            ${noteHtml(req)}
          </div>
        </details>
      </div>
    </article>`;
}

const cardHtml = (req) => (req.source === 'manual' ? blockCardHtml(req) : bookingCardHtml(req));

/* ---------------------------------------------------------------- render -- */

function fill(el, list, countEl, emptyCopy) {
  if (countEl) countEl.textContent = String(list.length);
  el.innerHTML = list.length
    ? list.map(cardHtml).join('')
    : `<p class="mgr-empty">${esc(emptyCopy)}</p>`;
}

/** Confirmed stays, grouped by the month they start in. */
function groupByMonth(rows) {
  const groups = new Map();
  for (const r of rows) {
    // '' for a confirmed row with no dates; sorts before any YYYY-MM, which is
    // where it belongs — it needs dates entered before it means anything.
    const key = r.checkin ? r.checkin.slice(0, 7) : '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => ({
      key,
      title: key ? `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}.` : 'Bez datuma',
      list: list.sort((a, b) => String(a.checkin).localeCompare(String(b.checkin))),
      nights: list.reduce((sum, r) => sum + nights(r.checkin, r.checkout), 0),
    }));
}

function renderConfirmed(rows) {
  els.countConfirmed.textContent = String(rows.length);
  if (!rows.length) {
    els.confirmed.innerHTML =
      '<p class="mgr-empty">Nema potvrđenih termina koji tek dolaze.</p>';
    return;
  }
  els.confirmed.innerHTML = groupByMonth(rows)
    .map(
      (g) => `<section class="mgr-group">
          <h3>${esc(g.title)}${g.nights ? `<span class="mgr-group__sum">${esc(nightsLabel(g.nights))}</span>` : ''}</h3>
          <div class="mgr-list">${g.list.map(cardHtml).join('')}</div>
        </section>`
    )
    .join('');
}

/** Which archive chip a row belongs to. */
const archiveKind = (r) =>
  r.status === 'declined' || r.status === 'cancelled' || r.status === 'answered' ? r.status : 'past';

function renderArchive(rows) {
  const q = view.q.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (view.chips.size && !view.chips.has(archiveKind(r))) return false;
    if (!q) return true;
    return [r.name, r.email, r.phone, r.message, r.owner_note].some((v) =>
      String(v || '').toLowerCase().includes(q)
    );
  });

  const active = q || view.chips.size;
  els.countArchive.textContent = active ? `${filtered.length} / ${rows.length}` : String(rows.length);
  els.archive.innerHTML = filtered.length
    ? filtered.map(cardHtml).join('')
    : `<p class="mgr-empty">${
        active ? 'Nema rezultata za ovaj filter.' : 'Odbijeni, otkazani i prošli termini skupljaju se ovdje.'
      }</p>`;
}

function render() {
  const today = todayYmd();
  const s = summarise(all, today);
  renderSummary(s, today);
  renderAlert(s);

  // Longest wait first. The API orders by check-in, which is the wrong axis for
  // a queue: someone who asked about November nine days ago is the one being
  // kept waiting, not whoever happens to arrive soonest.
  const pending = all
    .filter(isOpen)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  // A confirmed booking whose checkout has passed belongs in the archive, not in
  // the working list — otherwise the panel silts up over a season.
  // Only real bookings: an undated "confirmed" row is an enquiry (see isOpen).
  const confirmed = all.filter((r) => r.status === 'confirmed' && r.checkin && r.checkout >= today);
  const archive = all.filter((r) => !pending.includes(r) && !confirmed.includes(r));

  fill(els.pending, pending, els.countPending, 'Nema novih zahtjeva — sve je odgovoreno.');
  renderConfirmed(confirmed);
  renderArchive(archive);
}

/* ---------------------------------------------------------------- actions -- */

async function update(id, patch, btn) {
  if (btn) btn.disabled = true;
  try {
    await api(`/api/admin/requests/${id}`, { method: 'POST', body: JSON.stringify(patch) });
    await load();
    say('Sačuvano.', 'ok');
  } catch (err) {
    say(err.message, 'err');
    if (btn) btn.disabled = false;
  }
}

/* Notes save themselves. A note is a scratchpad, not a decision, and a "Sačuvaj"
   button next to one is a way to lose what you typed. These deliberately do not
   go through update(): a full re-render would blow away the focused input. */
const noteTimers = new Map();

async function commitNote(id) {
  clearTimeout(noteTimers.get(id));
  noteTimers.delete(id);

  const input = document.querySelector(`[data-note="${id}"]`);
  const row = all.find((r) => r.id === id);
  if (!input || !row) return;

  const next = input.value.trim();
  if ((row.owner_note || '') === next) return;

  const state = document.querySelector(`[data-notestate="${id}"]`);
  const mark = (text, kind = '') => {
    if (state) {
      state.textContent = text;
      state.className = `req__note-state${kind ? ` is-${kind}` : ''}`;
    }
  };

  mark('spremam…');
  try {
    await api(`/api/admin/requests/${id}`, { method: 'POST', body: JSON.stringify({ owner_note: next }) });
    row.owner_note = next || null;
    mark('sačuvano', 'ok');
  } catch (err) {
    mark(err.message, 'err');
  }
}

document.addEventListener('input', (e) => {
  const id = e.target.dataset?.note;
  if (!id) return;
  clearTimeout(noteTimers.get(id));
  noteTimers.set(id, setTimeout(() => commitNote(id), 800));
});

// focusout rather than blur: blur does not bubble, and these inputs are created
// and destroyed on every render, so a delegated listener is the only stable one.
document.addEventListener('focusout', (e) => {
  if (e.target.dataset?.note) commitNote(e.target.dataset.note);
});

document.addEventListener('click', (e) => {
  const viber = e.target.closest('[data-viber]');
  if (viber) {
    // The clipboard write is started inside the tap (iOS requires that); the
    // chat opens once it has gone through, or failed — either way she gets Viber.
    const open = () => (window.location.href = viber.dataset.viber);
    (navigator.clipboard?.writeText(viber.dataset.text) ?? Promise.reject())
      .then(() => say('Poruka je kopirana — u Viberu je zalijepite (dugi pritisak → Zalijepi).', 'ok'))
      .catch(() => say('Poruku nije moguće kopirati — otvaram Viber.', 'err'))
      .finally(open);
    return;
  }

  const act = e.target.closest('[data-act]');
  if (act) {
    const status = act.dataset.act;
    // Confirming is the one action with a consequence that is awkward to undo —
    // the guest may already have been told. Everything else is a status flip.
    if (status === 'confirmed' && !confirm('Potvrditi ovaj termin?')) return;
    update(act.dataset.id, { status }, act);
    return;
  }

  const chip = e.target.closest('[data-chip]');
  if (chip) {
    const kind = chip.dataset.chip;
    if (view.chips.has(kind)) view.chips.delete(kind);
    else view.chips.add(kind);
    chip.setAttribute('aria-pressed', String(view.chips.has(kind)));
    render();
  }
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-edit]');
  if (!form) return;
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  const btn = form.querySelector('button');
  update(
    form.dataset.edit,
    { checkin: data.checkin, checkout: data.checkout, guests: data.guests },
    btn
  );
});

let searchTimer;
els.archiveQ.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    view.q = els.archiveQ.value;
    render();
  }, 150);
});

document.getElementById('refresh').addEventListener('click', load);

// First visit: a short note on what the page is for. Remembered per browser;
// if storage is unavailable it is simply not shown, rather than every time.
const WELCOME_KEY = 'vm-manager-welcome-v1';
try {
  if (!localStorage.getItem(WELCOME_KEY)) {
    const welcome = document.getElementById('welcome');
    welcome.addEventListener('close', () => {
      try {
        localStorage.setItem(WELCOME_KEY, '1');
      } catch {
        /* private mode: it shows again next time, nothing worse */
      }
    });
    // A tap outside the card closes it too.
    welcome.addEventListener('click', (e) => {
      if (e.target === welcome) welcome.close();
    });
    welcome.showModal();
  }
} catch {
  /* storage blocked: skip the note */
}

// The block form sits folded on a phone (rare job, long form); a desktop has
// the room to show it in the side column.
if (matchMedia('(min-width: 900px)').matches) document.getElementById('blockbox').open = true;

document.getElementById('block-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  if (data.checkout <= data.checkin) {
    say('Datum "do" mora biti nakon datuma "od".', 'err');
    return;
  }
  try {
    await api('/api/admin/block', { method: 'POST', body: JSON.stringify(data) });
    form.reset();
    await load();
    say('Termin blokiran.', 'ok');
  } catch (err) {
    say(err.message, 'err');
  }
});

load();
