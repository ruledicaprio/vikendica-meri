// Sadržaji as a walk through the house.
//
// A frame pins under the navbar holding a copy of the floor picker's cabin
// sketch, one button per group and that group's chips. Scrolling past one
// step per group, or tapping its button, lights its part of the house and
// pops its chips in while the previous group's drop away:
// Vani → Prizemlje → 1. sprat → Cijela kuća.
//
// Without this (no script, reduced motion) the chips are the plain list
// they are in the HTML. Each chip's data-zone names its group; the button
// labels come from the guide's data-label-* attributes.

const ZONES = ['out', 'ground', 'first', 'all'];
const OUT_MS = 180; // the old group fades before the new one pops

export function initAmenityGuide(guide, sketch) {
  const list = guide.querySelector('.amenities');
  const chips = [...list.children];

  const nav = document.createElement('div');
  nav.className = 'amenity-guide__nav';
  const art = sketch.cloneNode(true);
  art.setAttribute('class', 'amenity-guide__art');
  art.setAttribute('viewBox', '0 0 252 252'); // the house only, without the picker's label column
  const frame = document.createElement('div');
  frame.className = 'amenity-guide__frame';

  // One empty block per group: scrolling past them is what moves the guide.
  const steps = ZONES.map((z) => {
    const s = document.createElement('div');
    s.className = 'amenity-guide__step';
    s.dataset.zone = z;
    return s;
  });

  const buttons = ZONES.map((z, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = guide.dataset[`label${z[0].toUpperCase()}${z.slice(1)}`];
    // Selecting a group goes to its step, so scroll and selection never disagree.
    b.addEventListener('click', () => steps[i].scrollIntoView({ behavior: 'smooth', block: 'center' }));
    nav.append(b);
    return b;
  });

  frame.append(nav, art, list);
  guide.append(frame, ...steps);
  guide.classList.add('is-guide');
  list.classList.add('amenities--pop');

  let zone = null;
  let timer = 0;
  function show(z) {
    if (z === zone) return;
    zone = z;
    guide.dataset.zone = z;
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(ZONES[i] === z)));
    const leaving = chips.filter((li) => !li.hidden && li.dataset.zone !== z);
    for (const li of leaving) {
      li.style.setProperty('--d', '0ms');
      li.classList.remove('is-in');
    }
    clearTimeout(timer);
    timer = setTimeout(
      () => {
        let k = 0;
        for (const li of chips) {
          const on = li.dataset.zone === zone;
          li.hidden = !on;
          li.classList.remove('is-in');
          if (on) li.style.setProperty('--d', `${Math.min(k++, 8) * 50}ms`);
        }
        // Two frames: the chips must render hidden once before they can pop.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            for (const li of chips) if (li.dataset.zone === zone) li.classList.add('is-in');
          })
        );
      },
      leaving.length ? OUT_MS : 0
    );
  }

  // The chip area keeps the height of the largest group, so the pinned frame
  // does not grow and shrink as the groups change.
  function holdHeight() {
    list.style.minHeight = '';
    let max = 0;
    for (const z of ZONES) {
      for (const li of chips) li.hidden = li.dataset.zone !== z;
      max = Math.max(max, list.offsetHeight);
    }
    for (const li of chips) li.hidden = li.dataset.zone !== zone;
    list.style.minHeight = `${max}px`;
  }
  let resized = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resized);
    resized = setTimeout(holdHeight, 150);
  });

  // The group whose step crosses the middle of the screen is the current one.
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) show(e.target.dataset.zone);
    },
    { rootMargin: '-50% 0px -50% 0px' }
  );
  steps.forEach((s) => io.observe(s));
  zone = ZONES[0];
  holdHeight();
  zone = null;
  show(ZONES[0]);
}
