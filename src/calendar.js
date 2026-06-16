/**
 * Vikendica Meri — Availability Calendar
 * ─────────────────────────────────────────────────────────────
 * Usage:  initCalendar(document.getElementById('cal-mount'))
 *
 * OWNER CONFIG ── edit BOOKED to mark reserved periods.
 *   status: 'booked'  → unavailable (red)
 *           'pending' → on hold / awaiting confirmation (amber)
 */

export const BOOKED = [
  { from: '2026-06-20', to: '2026-06-27', status: 'booked' },
  { from: '2026-07-04', to: '2026-07-11', status: 'booked' },
  { from: '2026-07-18', to: '2026-07-25', status: 'pending' },
  { from: '2026-08-01', to: '2026-08-10', status: 'booked' },
  { from: '2026-08-22', to: '2026-08-31', status: 'booked' },
  { from: '2026-12-20', to: '2027-01-05', status: 'booked' },
];

const MONTHS = [
  'Januar','Februar','Mart','April','Maj','Juni',
  'Juli','August','Septembar','Oktobar','Novembar','Decembar',
];
const DAYS = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];

/* ── helpers ───────────────────────────────────────────────── */
function toYMD(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function parseDate(s) { return new Date(s + 'T12:00:00'); }
function diffDays(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
function fmtDate(s) {
  const d = parseDate(s);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}.`;
}
function nightLabel(n) { return n === 1 ? '1 noć' : `${n} noć${n < 5 ? 'i' : 'i'}`; }

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
      const el     = document.createElement('div');

      el.className = `cal__day cal__day--${status}`;
      el.textContent = d;
      el.dataset.ymd = ymd;

      if (ymd === todayStr)                                   el.classList.add('cal__day--today');
      if (selStart && ymd === selStart)                       el.classList.add('cal__day--sel-start');
      if (selEnd   && ymd === selEnd)                         el.classList.add('cal__day--sel-end');
      if (selStart && selEnd && ymd > selStart && ymd < selEnd) el.classList.add('cal__day--in-range');

      if (status === 'available') el.addEventListener('click', () => handleClick(ymd));
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
    prevBtn.setAttribute('aria-label', 'Prethodni mjesec');
    prevBtn.innerHTML = '&#8249;';
    prevBtn.addEventListener('click', () => {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      render();
    });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'cal__nav-btn';
    nextBtn.type = 'button';
    nextBtn.setAttribute('aria-label', 'Sljedeći mjesec');
    nextBtn.innerHTML = '&#8250;';
    nextBtn.addEventListener('click', () => {
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      render();
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
          <span>${nightLabel(nights)} · do 10 osoba</span>
        </div>
        <div class="cal__sel-actions">
          <button class="btn btn--primary" id="cal-cta" type="button">Pošalji upit ↓</button>
          <button class="btn btn--ghost"   id="cal-clear" type="button">Poništi</button>
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
        <span class="cal__legend-dot cal__legend-dot--available"></span>Slobodno
      </div>
      <div class="cal__legend-item">
        <span class="cal__legend-dot cal__legend-dot--booked"></span>Zauzeto
      </div>
      <div class="cal__legend-item">
        <span class="cal__legend-dot cal__legend-dot--pending"></span>Na čekanju
      </div>
      <div class="cal__legend-item">
        <span class="cal__legend-dot cal__legend-dot--sel"></span>Vaš odabir
      </div>`;
    root.appendChild(legend);
  }

  /* ── click handler ── */
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
    render();
  }

  render();
}
