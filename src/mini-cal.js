// Compact availability in the hero: this month, widening to two on hover or
// via the toggle (touch has no hover). It reads the full calendar's data
// through its handle, so there is one fetch and one meaning of "free"; a free
// day starts the selection in the full calendar at #dostupnost.
import { t } from './i18n/ui.js';
import { dayStatus, toYMD } from './calendar.js';
import { teleport } from './teleport.js';

const label = (ymd) => t.formatDate(new Date(`${ymd}T12:00:00`), t.months);

function month(year, m, extra = '') {
  const lead = (new Date(year, m, 1).getDay() + 6) % 7;
  const days = new Date(year, m + 1, 0).getDate();
  const now = new Date();
  const today = toYMD(now.getFullYear(), now.getMonth(), now.getDate());

  let cells = t.days.map((d) => `<span class="mini-cal__dow">${d.slice(0, 2)}</span>`).join('');
  cells += '<span></span>'.repeat(lead);
  for (let d = 1; d <= days; d++) {
    const ymd = toYMD(year, m, d);
    const status = dayStatus(ymd);
    const cls = `mini-cal__day mini-cal__day--${status}${ymd === today ? ' mini-cal__day--today' : ''}`;
    const why = status === 'booked' ? ` — ${t.calBooked}` : status === 'pending' ? ` — ${t.calPending}` : '';
    cells +=
      status === 'available'
        ? `<button type="button" class="${cls}" data-ymd="${ymd}" aria-label="${label(ymd)}">${d}</button>`
        : `<button type="button" class="${cls}" disabled aria-label="${label(ymd)}${why}">${d}</button>`;
  }
  // Always six week rows, so a 5-row month and a 6-row month line up and the
  // hero does not change height when the second month appears.
  cells += '<span></span>'.repeat(42 - lead - days);

  return `
    <div class="mini-cal__month${extra}">
      <p class="mini-cal__title">${t.months[m]} ${year}</p>
      <div class="mini-cal__grid">${cells}</div>
    </div>`;
}

export async function initMiniCal(mount, cal) {
  if (!mount || !cal) return;

  await cal.ready;
  // An unreadable feed must not show every day as free.
  if (cal.offline) return mount.remove();

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  mount.setAttribute('role', 'group');
  mount.setAttribute('aria-label', t.miniCalLabel);
  mount.innerHTML = `
    <button class="mini-cal__toggle" type="button" aria-expanded="false" aria-label="${t.calNext}">›</button>
    <div class="mini-cal__months">
      ${month(y, m)}
      ${month(m === 11 ? y + 1 : y, (m + 1) % 12, ' mini-cal__month--next')}
    </div>
    <div class="mini-cal__legend">
      <span><i class="cal__legend-dot cal__legend-dot--available"></i>${t.calLegendAvailable}</span>
      <span><i class="cal__legend-dot cal__legend-dot--booked"></i>${t.calLegendBooked}</span>
      <span><i class="cal__legend-dot cal__legend-dot--pending"></i>${t.calLegendPending}</span>
    </div>`;
  mount.classList.add('is-ready');

  const toggle = mount.querySelector('.mini-cal__toggle');
  toggle.addEventListener('click', () => {
    const open = mount.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  mount.querySelector('.mini-cal__months').addEventListener('click', (e) => {
    const day = e.target.closest('.mini-cal__day--available');
    if (!day) return;
    cal.setStart(day.dataset.ymd);
    teleport(document.getElementById('dostupnost'));
  });
}
