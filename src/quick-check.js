// Compact availability check in the hero.
//
// Deliberately not a second calendar: it asks the one mounted at #dostupnost,
// through the handle initCalendar() returns. A guest who picks a free range up
// here lands on that calendar with the range already selected, which is the
// funnel the two hero buttons are for — see the panel's own copy for what each
// verdict means.
import { t } from './i18n/ui.js';

const todayYMD = () => new Date().toISOString().slice(0, 10);

export function initQuickCheck(trigger, mount, cal) {
  if (!trigger || !mount || !cal) return;

  mount.hidden = true;
  mount.innerHTML = `
    <form class="quick-check__form" novalidate>
      <div class="quick-check__field">
        <label for="qc-from">${t.qcFrom}</label>
        <input id="qc-from" name="from" type="date" min="${todayYMD()}" required />
      </div>
      <div class="quick-check__field">
        <label for="qc-to">${t.qcTo}</label>
        <input id="qc-to" name="to" type="date" min="${todayYMD()}" required />
      </div>
      <button class="btn btn--primary quick-check__submit" type="submit">${t.qcCheck}</button>
    </form>
    <p class="quick-check__verdict" role="status" aria-live="polite"></p>`;

  const form = mount.querySelector('form');
  const fromEl = mount.querySelector('#qc-from');
  const toEl = mount.querySelector('#qc-to');
  const verdict = mount.querySelector('.quick-check__verdict');

  const say = (msg, tone) => {
    verdict.textContent = msg;
    verdict.className = `quick-check__verdict quick-check__verdict--${tone}`;
  };

  const open = () => {
    mount.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    fromEl.focus();
  };

  const close = ({ refocus = true } = {}) => {
    mount.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (refocus) trigger.focus();
  };

  const isOpen = () => !mount.hidden;

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    isOpen() ? close() : open();
  });

  // Esc closes and hands focus back; clicking outside just closes. Without the
  // first, a keyboard user who opens this is stuck inside it.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) close();
  });
  document.addEventListener('click', (e) => {
    if (!isOpen()) return;
    if (mount.contains(e.target) || trigger.contains(e.target)) return;
    close({ refocus: false });
  });

  // Picking an arrival should not leave an earlier departure sitting there.
  fromEl.addEventListener('change', () => {
    toEl.min = fromEl.value || todayYMD();
    if (toEl.value && toEl.value <= fromEl.value) toEl.value = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const from = fromEl.value;
    const to = toEl.value;

    if (!from || !to) return say(t.qcNeedDates, 'warn');
    if (to <= from) return say(t.qcBadRange, 'warn');

    say(t.qcChecking, 'muted');
    await cal.ready;

    // An unreadable feed must not be reported as "free" — that is a promise the
    // owner would have to break by hand.
    if (cal.offline) return say(t.qcOffline, 'warn');

    const blocked = cal.checkRange(from, to);
    if (blocked) {
      const why =
        blocked === 'booked' ? t.qcBooked : blocked === 'pending' ? t.qcPending : t.qcPast;
      return say(why, 'bad');
    }

    say(t.qcFree, 'good');
    cal.setRange(from, to);
    close({ refocus: false });
    document.getElementById('dostupnost')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
