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

const todayYmd = () => new Date().toISOString().slice(0, 10);

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

function say(text, kind = '') {
  els.status.textContent = text;
  els.status.className = `mgr-status${kind ? ` is-${kind}` : ''}`;
}

/* ------------------------------------------------------------------- data -- */

let all = [];

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
  const pendingRows = list.filter((r) => r.status === 'pending');
  const confirmed = list.filter((r) => r.status === 'confirmed' && r.checkin);

  const conflictRows = pendingRows.filter((r) =>
    confirmed.some((o) => o.id !== r.id && overlaps(r, o))
  );

  const upcoming = confirmed
    .filter((r) => r.checkin >= today)
    .sort((a, b) => a.checkin.localeCompare(b.checkin));
  const inHouse = confirmed.find((r) => r.checkin <= today && r.checkout >= today) || null;

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
    nights30,
    oldestPendingDays: ages.length ? Math.max(...ages) : null,
  };
}

function statHtml({ value, label, sub, tone }) {
  return `<div class="mgr-stat${tone ? ` is-${tone}` : ''}">
      <span class="mgr-stat__value">${esc(value)}</span>
      <span class="mgr-stat__label">${esc(label)}</span>
      <span class="mgr-stat__sub">${esc(sub || '')}</span>
    </div>`;
}

function renderSummary(s) {
  const arrival = s.nextArrival
    ? s.daysToArrival === 0
      ? 'danas'
      : `za ${daysLabel(s.daysToArrival)}`
    : '—';

  els.summary.innerHTML = [
    statHtml({
      value: String(s.pending),
      label: 'Na čekanju',
      sub:
        s.oldestPendingDays === null
          ? 'sve riješeno'
          : `najstariji čeka ${daysLabel(s.oldestPendingDays)}`,
      tone: s.conflicts ? 'red' : s.pending ? 'amber' : '',
    }),
    statHtml({
      value: arrival,
      label: 'Sljedeći dolazak',
      sub: s.nextArrival
        ? `${s.nextArrival.name} · ${fmtShort(s.nextArrival.checkin)}`
        : 'nema potvrđenih termina',
      tone: s.nextArrival ? 'green' : '',
    }),
    statHtml({
      value: String(s.nights30),
      label: `Noći / ${HORIZON_DAYS} dana`,
      sub: `od mogućih ${HORIZON_DAYS}`,
      tone: '',
    }),
    statHtml({
      value: s.inHouse ? s.inHouse.name : 'prazno',
      label: 'Trenutno u kući',
      sub: s.inHouse ? `do ${fmtShort(s.inHouse.checkout)}` : '—',
      tone: s.inHouse ? 'green' : '',
    }),
  ].join('');
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
    const digits = req.phone.replace(/\D/g, '');
    // WhatsApp has no subject line, so the greeting has to carry it.
    links.push(
      `<a class="mgr-btn mgr-btn--reply" target="_blank" rel="noopener"
          href="https://wa.me/${esc(digits)}?text=${encodeURIComponent(body)}">💬 Odgovori na WhatsApp</a>`
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
};

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
  const age = req.status === 'pending' ? ageDays(req.created_at) : null;
  const stale = age !== null && age >= STALE_DAYS;
  const dates = req.checkin
    ? `${fmtDate(req.checkin)} → ${fmtDate(req.checkout)}`
    : 'Bez datuma (opći upit)';

  const who = [];
  if (req.email) who.push(`<a href="mailto:${esc(req.email)}">${esc(req.email)}</a>`);
  if (req.phone) {
    const digits = req.phone.replace(/[^\d+]/g, '');
    who.push(
      `<a href="tel:${esc(digits)}">${esc(req.phone)}</a> · ` +
        `<a href="https://wa.me/${esc(digits.replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp</a>`
    );
  }
  if (req.guests) who.push(`${esc(req.guests)} gostiju`);

  // One button carries the decision; everything else is a step back from it and
  // lives behind the disclosure, so the card reads as a question with an answer.
  const primary =
    req.status === 'pending'
      ? `<button class="mgr-btn mgr-btn--ok" data-act="confirmed" data-id="${esc(req.id)}">Potvrdi</button>`
      : req.status === 'confirmed'
        ? `<button class="mgr-btn mgr-btn--no" data-act="cancelled" data-id="${esc(req.id)}">Otkaži</button>`
        : `<button class="mgr-btn" data-act="pending" data-id="${esc(req.id)}">Vrati na čekanje</button>`;

  const secondary =
    req.status === 'pending'
      ? `<button class="mgr-btn mgr-btn--no" data-act="declined" data-id="${esc(req.id)}">Odbij</button>`
      : req.status === 'confirmed'
        ? `<button class="mgr-btn mgr-btn--ghost" data-act="pending" data-id="${esc(req.id)}">Vrati na čekanje</button>`
        : '';

  const meta = [
    esc(req.name),
    `primljeno ${esc((req.created_at || '').slice(0, 10))}`,
    age !== null ? `čeka ${esc(daysLabel(age))}` : '',
    req.updated_at && req.status !== 'pending'
      ? `odlučeno ${esc(fmtShort(req.updated_at.slice(0, 10)))}`
      : '',
  ].filter(Boolean);

  return `
    <article class="req${conflicts.length ? ' req--conflict' : ''}${stale ? ' is-stale' : ''}" id="req-${esc(req.id)}">
      <div class="req__head">
        <span class="req__dates">${esc(dates)}</span>
        ${n ? `<span class="req__nights">${esc(nightsLabel(n))}</span>` : ''}
        <span class="req__badge">${esc(req.source)}</span>
        <span class="req__status is-${esc(req.status)}">${esc(STATUS_LABEL[req.status] || req.status)}</span>
      </div>
      <p class="req__meta">${meta.join(' · ')}</p>
      ${conflicts.length ? `<p class="req__warn">Preklapa se sa ${conflicts.length} potvrđenim terminom. Potvrda bi napravila dvostruku rezervaciju.</p>` : ''}
      ${who.length ? `<p class="req__who">${who.join('')}</p>` : ''}
      ${req.message ? `<p class="req__msg">${esc(req.message)}</p>` : ''}
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
  r.status === 'declined' ? 'declined' : r.status === 'cancelled' ? 'cancelled' : 'past';

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
  renderSummary(s);
  renderAlert(s);

  // Longest wait first. The API orders by check-in, which is the wrong axis for
  // a queue: someone who asked about November nine days ago is the one being
  // kept waiting, not whoever happens to arrive soonest.
  const pending = all
    .filter((r) => r.status === 'pending')
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  // A confirmed booking whose checkout has passed belongs in the archive, not in
  // the working list — otherwise the panel silts up over a season.
  const confirmed = all.filter((r) => r.status === 'confirmed' && (!r.checkout || r.checkout >= today));
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
