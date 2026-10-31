// Floors as an A-frame cross-section: a camera move down through the cabin.
//
// The stage pins under the navbar. The house is drawn zoomed in, larger than
// its view window, and scroll slides it upward, so the view travels from the
// roof down to the ground floor. The floor at the window's centre is lit and
// its card shows. While the section scrolls in (--enter, 0→1) the
// roof outline draws itself and the house grows to size. A tap on a floor in
// the drawing scrolls to it; keyboard focus on a card selects it.
//
// Reduced motion, or no JavaScript: none of this runs, and the drawing sits
// above the three cards as a static diagram (see .aframe in style.css).
const VIEWBOX = { w: 320, h: 300 };
// In viewBox units: the line the view centres on at the start (roof floor) and
// end (ground floor) of the trip, and the floor slabs (see the SVG in index.html).
const FOCUS_FROM = 70;
const FOCUS_TO = 246;
const SLABS = [200, 110]; // ground|1st, 1st|2nd
const FOCUS_AT = { 2: FOCUS_FROM, 1: 155, 0: FOCUS_TO };
const floorOf = (y) => (y >= SLABS[0] ? 0 : y >= SLABS[1] ? 1 : 2);

export function initAframeFloors(root, navbar) {
  if (!root) return;
  const stage = root.querySelector('.aframe__stage');
  const view = root.querySelector('.aframe__view');
  const house = root.querySelector('.aframe__house');
  root.classList.add('is-scene');

  let active = -1;
  const select = (floor) => {
    if (floor === active) return;
    active = floor;
    root.dataset.active = String(floor);
  };

  // Sizes that only change on resize or font load.
  let size = null;
  const measure = () => {
    root.style.setProperty('--nav', `${navbar?.offsetHeight || 0}px`);
    const W = view.clientWidth;
    const H = view.clientHeight;
    // Zoomed in: about two floors in the window, the roof lines still in sight.
    const w = Math.max(W, Math.min(W * 1.9, (H * 2.5 * VIEWBOX.w) / VIEWBOX.h));
    const h = (w * VIEWBOX.h) / VIEWBOX.w;
    house.style.width = `${w}px`;
    house.style.height = `${h}px`;
    size = { H, h };
  };

  // 0 when the stage pins, 1 when it lets go.
  const progress = (r) => {
    const nav = navbar?.offsetHeight || 0;
    const range = r.height - stage.offsetHeight;
    return range > 0 ? Math.min(1, Math.max(0, (nav - r.top) / range)) : 0;
  };

  let frame = 0;
  const update = () => {
    frame = 0;
    const r = root.getBoundingClientRect();
    const p = progress(r);
    const vh = window.innerHeight;
    const enter = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.8)));
    root.style.setProperty('--enter', enter.toFixed(3));
    // The point of the house at the window's centre slides from the roof floor
    // to the ground floor; the floor under it is the lit one.
    const focus = FOCUS_FROM + (FOCUS_TO - FOCUS_FROM) * p;
    const y = size.H / 2 - (focus / VIEWBOX.h) * size.h;
    const s = 0.85 + 0.15 * enter;
    house.style.transform = `translate(-50%, ${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
    select(floorOf(focus));
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  const onResize = () => {
    measure();
    onScroll();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  // The cards, and so the window, change height once the web fonts arrive.
  document.fonts?.ready.then(onResize);
  measure();
  update();

  // Scroll position at which a floor sits in the middle of the window.
  const floorTop = (floor) => {
    const r = root.getBoundingClientRect();
    const range = r.height - stage.offsetHeight;
    const nav = navbar?.offsetHeight || 0;
    const p = (FOCUS_AT[floor] - FOCUS_FROM) / (FOCUS_TO - FOCUS_FROM);
    return window.scrollY + r.top - nav + p * range;
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
