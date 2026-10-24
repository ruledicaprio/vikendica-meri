// Floors as an A-frame cross-section, driven by scroll.
//
// The house draws itself and grows while it scrolls into view (--enter, 0→1).
// Then the stage is sticky for a stretch of scroll in which the floors light up
// one at a time, ground floor first, and only that floor's card shows. A tap on
// a floor in the drawing scrolls to it; keyboard focus on a card selects it.
//
// Reduced motion, or no JavaScript: none of this runs, and the drawing sits
// above the three cards as a static diagram (see .aframe in style.css).
const FLOORS = 3;

export function initAframeFloors(root, navbar) {
  if (!root) return;
  const stage = root.querySelector('.aframe__stage');
  root.classList.add('is-scene');

  let active = -1;
  const select = (i) => {
    if (i === active) return;
    active = i;
    root.dataset.active = String(i);
  };

  let frame = 0;
  const update = () => {
    frame = 0;
    const vh = window.innerHeight;
    const nav = navbar?.offsetHeight || 0;
    root.style.setProperty('--nav', `${nav}px`);
    const r = root.getBoundingClientRect();
    // Draw-in: from the top edge entering the screen to it reaching ~20% from the top.
    const enter = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.8)));
    root.style.setProperty('--enter', enter.toFixed(3));
    // Pinned stretch: how far the stage has travelled through the wrapper.
    const range = r.height - stage.offsetHeight;
    const p = range > 0 ? Math.min(0.999, Math.max(0, (nav - r.top) / range)) : 0;
    select(Math.floor(p * FLOORS));
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();

  // Scroll position at which floor i sits in the middle of its stretch.
  const floorTop = (i) => {
    const r = root.getBoundingClientRect();
    const range = r.height - stage.offsetHeight;
    const nav = navbar?.offsetHeight || 0;
    return window.scrollY + r.top - nav + ((i + 0.5) / FLOORS) * range;
  };
  root.querySelectorAll('.aframe__band').forEach((band) => {
    band.addEventListener('click', () =>
      window.scrollTo({ top: floorTop(Number(band.dataset.floor)), behavior: 'smooth' })
    );
  });
  // Tabbing onto a hidden card's photo button brings that floor forward.
  root.addEventListener('focusin', (e) => {
    const card = e.target.closest('.floor[data-floor]');
    if (card) select(Number(card.dataset.floor));
  });
}
