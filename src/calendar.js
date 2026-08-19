/**
 * Vikendica Meri — Availability Calendar
 * ─────────────────────────────────────────────────────────────
 * Usage:  initCalendar(document.getElementById('cal-mount'))
 *
 * Availability comes from /api/availability, which the owner drives from the
 * manager panel. Statuses map to the two states this component already renders:
 *   'booked'  → unavailable (red)   ← a confirmed booking or a manual block
 *   'pending' → on hold (amber)     ← a request the owner has not answered yet
 */
import { t } from './i18n/ui.js';

// Populated by loadAvailability() below. Starts empty so the first paint shows a
// working calendar rather than nothing; a failed fetch says so out loud instead
// of quietly implying every date is free.
export const BOOKED = [];

const MONTHS = t.months;
const DAYS = t.days;

/* ── helpers ───────────────────────────────────────────────── */
function toYMD(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function parseDate(s) { return new Date(s + 'T12:00:00'); }
function diffDays(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
function fmtDate(s) {
  return t.formatDate(parseDate(s), MONTHS);
}
// Bosnian: 1 noć, everything else noći. (The old ternary here returned 'i' on
// both branches, so it never did anything.)
function nightLabel(n) { return t.nights(n); }

function dayStatus(ymd) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (parseDate(ymd) < today) return 'past';
  for (const b of BOOKED) {
    if (ymd >= b.from && ymd <= b.to) return b.status;
  }
  return 'available';
}

function rangeConflicts(from, to) {
  return BOOKED.some((b) => from <= b.to && to >= b.from);
}

/* ── main export ───────────────────────────────────────────── */
export function initCalendar(container) {
  let viewYear  = new Date().getFullYear();
  let viewMonth = new Date().getMonth();
  let selStart  = null;
  let selEnd    = null;
  // Set when /api/availability could not be read. render() then says so, rather
  // than showing an all-free calendar that would be a lie.
  let offline   = false;

  const root = document.createElement('div');
  root.className = 'cal';
  container.appendChild(root);

  /* ── build one month grid ── */
  function buildMonth(year, month) {
    const wrap = document.createElement('div');
    wrap.className = 'cal__month';

    const title = document.createElement('div');
    title.className = 'cal__month-title';
    title.textContent = `${MONTHS[month]} ${year}`;
    wrap.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'cal__grid';

    // DOW headers (Mon-first)
    DAYS.forEach((d) => {
      const el = document.createElement('div');
      el.className = 'cal__dow';
      el.textContent = d;
      grid.appendChild(el);
    });

    // Leading empty cells
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
    for (let e = 0; e < firstDow; e++) {
      const el = document.createElement('div');
      el.className = 'cal__day cal__day--empty';
      grid.appendChild(el);
    }

    const todayStr   = toYMD(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const ymd    = toYMD(year, month, d);
      const status = dayStatus(ymd);
      // A button, not a div: these were click-only and unreachable by keyboard.
      const el     = document.createElement('button');
      el.type = 'button';

      el.className = `cal__day cal__day--${status}`;
      el.textContent = d;
      el.dataset.ymd = ymd;

      const selected = (selStart && ymd === selStart) || (selEnd && ymd === selEnd);
      if (ymd === todayStr)                                   el.classList.add('cal__day--today');
      if (selStart && ymd === selStart)                       el.classList.add('cal__day--sel-start');
      if (selEnd   && ymd === selEnd)                         el.classList.add('cal__day--sel-end');
      if (selStart && selEnd && ymd > selStart && ymd < selEnd) el.classList.add('cal__day--in-range');

      // The bare number is meaningless out of context, so announce the full date
      // and why an unavailable day cannot be chosen.
      const suffix = status === 'booked' ? ` — ${t.calBooked}`
        : status === 'pending' ? ` — ${t.calPending}`
        : status === 'past' ? ` — ${t.calPast}` : '';
      el.setAttribute('aria-label', fmtDate(ymd) + suffix);

      if (status === 'available') {
        el.setAttribute('aria-pressed', String(!!selected));
        el.addEventListener('click', () => handleClick(ymd));
      } else {
        el.disabled = true;
      }
      grid.appendChild(el);
    }

    wrap.appendChild(grid);
    return wrap;
  }

  /* ── full render ── */
  function render() {
    root.innerHTML = '';

    // ── nav bar ──
    const nav = document.createElement('div');
    nav.className = 'cal__nav';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'cal__nav-btn';
    prevBtn.type = 'button';
    prevBtn.setAttribute('aria-label', t.calPrev);
    prevBtn.innerHTML = '&#8249;';
    prevBtn.addEventListener('click', () => {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      render();
      // Same re-render problem as the day cells: keep focus on the arrow so it
      // can be pressed repeatedly from the keyboard.
      root.querySelector('.cal__nav-btn')?.focus();
    });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'cal__nav-btn';
    nextBtn.type = 'button';
    nextBtn.setAttribute('aria-label', t.calNext);
    nextBtn.innerHTML = '&#8250;';
    nextBtn.addEventListener('click', () => {
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      render();
      root.querySelectorAll('.cal__nav-btn')[1]?.focus();
    });

    const nextMIdx = (viewMonth + 1) % 12;
    const nextMYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    const navLabel = document.createElement('span');
    navLabel.className = 'cal__nav-label';
    navLabel.textContent = `${MONTHS[viewMonth]} ${viewYear} – ${MONTHS[nextMIdx]} ${nextMYear}`;

    nav.appendChild(prevBtn);
    nav.appendChild(navLabel);
    nav.appendChild(nextBtn);
    root.appendChild(nav);

    // ── two-month grid ──
    const months = document.createElement('div');
    months.className = 'cal__months';
    months.appendChild(buildMonth(viewYear, viewMonth));
    months.appendChild(buildMonth(nextMYear, nextMIdx));
    root.appendChild(months);

    // ── selection box ──
    if (selStart && selEnd) {
      const nights = diffDays(selStart, selEnd);
      const box = document.createElement('div');
      box.className = 'cal__sel-box';
      box.innerHTML = `
        <div class="cal__sel-info">
          <strong>${fmtDate(selStart)} → ${fmtDate(selEnd)}</strong>
          <span>${nightLabel(nights)} · ${t.calCapacity}</span>
        </div>
        <div class="cal__sel-actions">
          <button class="btn btn--primary" id="cal-cta" type="button">${t.calSend}</button>
          <button class="btn btn--ghost"   id="cal-clear" type="button">${t.calClear}</button>
        </div>`;
      root.appendChild(box);

      root.querySelector('#cal-cta').addEventListener('click', () => {
        // Pre-fill the contact form
        const fromEl    = document.getElementById('f-from');
        const toEl      = document.getElementById('f-to');
        const msgEl     = document.getElementById('f-msg');
        if (fromEl) fromEl.value = selStart;
        if (toEl)   toEl.value   = selEnd;
        if (msgEl && !msgEl.value) {
          msgEl.value =
            `Dolazak: ${selStart}\nOdlazak: ${selEnd}\nBroj noći: ${nights}`;
        }
        const form = document.getElementById('reserve-form');
        if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      root.querySelector('#cal-clear').addEventListener('click', () => {
        selStart = selEnd = null;
        render();
      });
    }

    // ── legend ──
    const legend = document.createElement('div');
    legend.className = 'cal__legend';
    legend.innerHTML = `
      <div class="cal__legend-item">
        <span class="cal__legend-dot cal__legend-dot--available"></span>${t.calLegendAvailable}
      </div>
      <div class="cal__legend-item">
        <span class="cal__legend-dot cal__legend-dot--booked"></span>${t.calLegendBooked}
      </div>
      <div class="cal__legend-item">
        <span class="cal__legend-dot cal__legend-dot--pending"></span>${t.calLegendPending}
      </div>
      <div class="cal__legend-item">
        <span class="cal__legend-dot cal__legend-dot--sel"></span>${t.calLegendSelected}
      </div>`;
    root.appendChild(legend);

    if (offline) {
      const note = document.createElement('p');
      note.className = 'cal__notice';
      note.textContent = t.calOffline;
      root.appendChild(note);
    }
  }

  /* ── availability ── */
  async function loadAvailability() {
    try {
      const res = await fetch('/api/availability', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      const { ranges } = await res.json();
      BOOKED.length = 0;
      for (const r of ranges || []) {
        if (!r.from || !r.to) continue;
        // The API's vocabulary is the database's; this component's is the CSS's.
        BOOKED.push({ from: r.from, to: r.to, status: r.status === 'pending' ? 'pending' : 'booked' });
      }
      offline = false;
    } catch {
      offline = true;
    }
    render();
  }

  /* ── click handler ── */
  // render() replaces the whole subtree, so the button that was just activated
  // no longer exists afterwards and focus would fall back to <body>. Re-find the
  // equivalent day by its date and restore focus there.
  function renderKeepingFocus(ymd) {
    const hadFocus = document.activeElement?.classList.contains('cal__day');
    render();
    if (hadFocus) root.querySelector(`.cal__day[data-ymd="${ymd}"]`)?.focus();
  }

  function handleClick(ymd) {
    if (!selStart || (selStart && selEnd)) {
      // start a fresh selection
      selStart = ymd;
      selEnd   = null;
    } else {
      if (ymd <= selStart) {
        selStart = ymd;
        selEnd   = null;
      } else if (rangeConflicts(selStart, ymd)) {
        // range passes through booked days — restart
        selStart = ymd;
        selEnd   = null;
      } else {
        selEnd = ymd;
      }
    }
    renderKeepingFocus(ymd);
  }

  render();
  loadAvailability();
}
