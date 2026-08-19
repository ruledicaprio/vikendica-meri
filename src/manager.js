// Manager panel.
//
// Everything here talks to /api/admin/*, which Cloudflare Access protects at the
// edge and worker/access.js verifies again. There is no login code in this file
// on purpose: if the request reaches the API at all, the caller is the owner.
import './manager.css';

const MONTHS = [
  'januar', 'februar', 'mart', 'april', 'maj', 'juni',
  'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar',
];

const els = {
  status: document.getElementById('status'),
  pending: document.getElementById('list-pending'),
  confirmed: document.getElementById('list-confirmed'),
  archive: document.getElementById('list-archive'),
  countPending: document.getElementById('count-pending'),
  countConfirmed: document.getElementById('count-confirmed'),
  countArchive: document.getElementById('count-archive'),
};

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const todayYmd = () => new Date().toISOString().slice(0, 10);

function fmtDate(ymd) {
  if (!ymd) return '';
  const d = new Date(`${ymd}T12:00:00`);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}.`;
}

function nights(from, to) {
  if (!from || !to) return 0;
  return Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000);
}

function say(text, kind = '') {
  els.status.textContent = text;
  els.status.className = `mgr-status${kind ? ` is-${kind}` : ''}`;
}

/* ------------------------------------------------------------------- data -- */

let all = [];

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
  say('Učitavanje…');
  try {
    const { requests } = await api('/api/admin/requests');
    all = requests;
    render();
    say(`${requests.length} zahtjeva ukupno.`);
  } catch (err) {
    say(err.message, 'err');
  }
}

/* ----------------------------------------------------------------- render -- */

/**
 * Confirmed ranges a pending request would collide with.
 *
 * Ranges are compared inclusively on both ends, matching the availability
 * endpoint: a checkout day is treated as occupied. Erring towards flagging one
 * extra conflict is the right direction for a warning whose whole job is to stop
 * a double booking.
 */
function conflictsFor(req) {
  if (!req.checkin) return [];
  return all.filter(
    (o) =>
      o.id !== req.id &&
      o.status === 'confirmed' &&
      o.checkin &&
      req.checkin <= o.checkout &&
      req.checkout >= o.checkin
  );
}

function cardHtml(req) {
  const conflicts = req.status === 'pending' ? conflictsFor(req) : [];
  const n = nights(req.checkin, req.checkout);
  const dates = req.checkin
    ? `${fmtDate(req.checkin)} → ${fmtDate(req.checkout)}`
    : 'Bez datuma (opći upit)';

  const who = [];
  if (req.source !== 'manual') {
    if (req.email) who.push(`<a href="mailto:${esc(req.email)}">${esc(req.email)}</a>`);
    if (req.phone) {
      const digits = req.phone.replace(/[^\d+]/g, '');
      who.push(
        `<a href="tel:${esc(digits)}">${esc(req.phone)}</a> · ` +
          `<a href="https://wa.me/${esc(digits.replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp</a>`
      );
    }
    if (req.guests) who.push(`${req.guests} gostiju`);
  }

  const actions =
    req.status === 'pending'
      ? `<button class="mgr-btn mgr-btn--ok" data-act="confirmed" data-id="${req.id}">Potvrdi</button>
         <button class="mgr-btn mgr-btn--no" data-act="declined" data-id="${req.id}">Odbij</button>`
      : req.status === 'confirmed'
        ? `<button class="mgr-btn mgr-btn--no" data-act="cancelled" data-id="${req.id}">Otkaži</button>`
        : `<button class="mgr-btn" data-act="pending" data-id="${req.id}">Vrati na čekanje</button>`;

  return `
    <article class="req${conflicts.length ? ' req--conflict' : ''}">
      <div class="req__head">
        <span class="req__dates">${esc(dates)}</span>
        ${n ? `<span class="req__nights">${n} ${n === 1 ? 'noć' : 'noći'}</span>` : ''}
        <span class="req__badge${req.source === 'manual' ? ' req__badge--manual' : ''}">${esc(req.source)}</span>
      </div>
      <p class="req__meta">${esc(req.name)} · primljeno ${esc((req.created_at || '').slice(0, 10))}</p>
      ${conflicts.length ? `<p class="req__warn">Preklapa se sa ${conflicts.length} potvrđenim terminom. Potvrda bi napravila dvostruku rezervaciju.</p>` : ''}
      ${who.length ? `<p class="req__who">${who.join('')}</p>` : ''}
      ${req.message ? `<p class="req__msg">${esc(req.message)}</p>` : ''}
      <div class="req__actions">
        ${actions}
        <input class="req__note" type="text" data-note="${req.id}"
               value="${esc(req.owner_note || '')}" placeholder="Interna bilješka" />
        <button class="mgr-btn mgr-btn--ghost" data-savenote="${req.id}">Sačuvaj</button>
      </div>
    </article>`;
}

function fill(el, list, countEl) {
  countEl.textContent = String(list.length);
  el.innerHTML = list.length
    ? list.map(cardHtml).join('')
    : '<p class="mgr-empty">Ništa ovdje.</p>';
}

function render() {
  const today = todayYmd();
  const pending = all.filter((r) => r.status === 'pending');
  // A confirmed booking whose checkout has passed belongs in the archive, not in
  // the working list — otherwise the panel silts up over a season.
  const confirmed = all.filter((r) => r.status === 'confirmed' && (!r.checkout || r.checkout >= today));
  const archive = all.filter((r) => !pending.includes(r) && !confirmed.includes(r));

  fill(els.pending, pending, els.countPending);
  fill(els.confirmed, confirmed, els.countConfirmed);
  fill(els.archive, archive, els.countArchive);
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
  const save = e.target.closest('[data-savenote]');
  if (save) {
    const id = save.dataset.savenote;
    const input = document.querySelector(`[data-note="${id}"]`);
    update(id, { owner_note: input.value }, save);
  }
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
