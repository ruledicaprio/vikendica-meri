// Segmented gallery + lightbox.
// Images live in /public/<cat>/ and are served at /<cat>/ (dev + build) as stable,
// cacheable URLs. The file list is provided by the build-time `virtual:gallery`
// manifest (see vite.config.js) — no bundling/duplication of the photos.
import { manifest } from 'virtual:gallery';
import { creditFor, creditHtml } from './credits.js';

function base(url) {
  return url.split('/').pop();
}

// Default ("scene") cover image: a scene-* file, then a front-* file, else first.
function pickCover(urls) {
  return (
    urls.find((u) => base(u).startsWith('scene-')) ||
    urls.find((u) => base(u).startsWith('front-')) ||
    urls[0] ||
    ''
  );
}

const META = {
  smjestaj: { label: 'Smještaj' },
  vlasic: { label: 'Planina Vlašić' },
  travnik: { label: 'Travnik' },
};

/* ----------------------------------------------------------------------------
   Alt text
   Derived from the filename's semantic prefix. Generic alt ("Smještaj 3") is
   worthless to screen readers and invisible to image search, and these photos
   are the main thing a guest wants to see.
---------------------------------------------------------------------------- */
const ALT_ROOM = [
  [/^front/, 'Prednja strana A-frame vikendice Meri na Babanovcu'],
  [/^back/, 'Zadnja strana vikendice Meri sa terasom'],
  [/^first-floor-bath/, 'Kupatilo na prvom spratu vikendice Meri'],
  [/^zero-floor-bath/, 'Kupatilo u prizemlju vikendice Meri'],
  [/^first-floor/, 'Soba na prvom spratu vikendice Meri'],
];

const ALT_VIEW = [
  [/galica/, 'Pogled na Galicu, planina Vlašić'],
  [/ugar/, 'Pogled na Ugar, planina Vlašić'],
];

function altFor(key, url, i) {
  const name = base(url).replace(/\.[a-z]+$/i, '');
  if (key === 'smjestaj') {
    const hit = ALT_ROOM.find(([re]) => re.test(name));
    return hit ? hit[1] : `Unutrašnjost vikendice Meri, Babanovac — fotografija ${i + 1}`;
  }
  if (key === 'vlasic') {
    const hit = ALT_VIEW.find(([re]) => re.test(name));
    return hit ? hit[1] : `Planina Vlašić i Babanovac — fotografija ${i + 1}`;
  }
  return `Grad Travnik, centralna Bosna — fotografija ${i + 1}`;
}

// Bosnian count agreement: 1 fotografija, 2–4 fotografije, 5+ fotografija
// (and the teens always take the last form).
function photoCount(n) {
  const last = n % 10;
  const teen = n % 100 >= 11 && n % 100 <= 14;
  if (!teen && last === 1) return `${n} fotografija`;
  if (!teen && last >= 2 && last <= 4) return `${n} fotografije`;
  return `${n} fotografija`;
}

export const categories = Object.fromEntries(
  Object.keys(META).map((key) => {
    const urls = manifest[key] || [];
    return [key, { key, label: META[key].label, urls, cover: pickCover(urls) }];
  })
);

export function getCategory(key) {
  return categories[key];
}

/** Random image from a category (≠ current, when possible). */
export function randomImage(key, exclude) {
  const urls = categories[key]?.urls || [];
  if (urls.length === 0) return '';
  if (urls.length === 1) return urls[0];
  let pick = exclude;
  let guard = 0;
  while ((pick === exclude || !pick) && guard++ < 10) {
    pick = urls[Math.floor(Math.random() * urls.length)];
  }
  return pick;
}

/* ----------------------------------------------------------------------------
   Crossfade helper for a two-layer square
---------------------------------------------------------------------------- */
function makeCrossfader(front, back, urls) {
  let showingBack = false;
  return (nextUrl) => {
    if (!nextUrl || urls.length < 2) return;
    const showEl = showingBack ? front : back;
    const hideEl = showingBack ? back : front;
    const img = new Image();
    img.onload = () => {
      showEl.style.backgroundImage = `url('${nextUrl}')`;
      showEl.style.opacity = '1';
      hideEl.style.opacity = '0';
      showingBack = !showingBack;
    };
    img.src = nextUrl;
  };
}

/** Inject two crossfade layers into `el` and swap to a random image on hover. */
export function attachHoverSwap(el, key) {
  const c = categories[key];
  if (!c) return;
  el.innerHTML = `
    <span class="media-layer is-front" style="background-image:url('${c.cover}')"></span>
    <span class="media-layer is-back"></span>`;
  const front = el.querySelector('.is-front');
  const back = el.querySelector('.is-back');
  const swap = makeCrossfader(front, back, c.urls);
  let current = c.cover;
  el.addEventListener('mouseenter', () => {
    const next = randomImage(key, current);
    current = next;
    swap(next);
  });
}

/* ----------------------------------------------------------------------------
   Build segments
---------------------------------------------------------------------------- */
const ORDER = ['smjestaj', 'vlasic', 'travnik'];
const THUMB_COUNT = 6;

export function initGallery(container, openLightbox) {
  container.innerHTML = ORDER.map((key) => {
    const c = categories[key];
    const thumbs = c.urls.slice(0, THUMB_COUNT);
    return `
      <article class="segment reveal" data-cat="${key}">
        <button class="segment__square" data-cat="${key}" aria-label="Otvori galeriju: ${c.label}">
          <span class="segment__layer is-front" style="background-image:url('${c.cover}')"></span>
          <span class="segment__layer is-back"></span>
          <span class="segment__overlay">
            <span class="segment__title">${c.label}</span>
            <span class="segment__count">${photoCount(c.urls.length)}</span>
          </span>
        </button>
        <div class="segment__thumbs">
          ${thumbs
            .map(
              (u, i) => `
            <button class="thumb" data-cat="${key}" data-index="${i}" aria-label="Otvori fotografiju ${i + 1} od ${c.urls.length}">
              <img src="${u}" loading="lazy" decoding="async" alt="${altFor(key, u, i)}" />
            </button>`
            )
            .join('')}
          ${
            c.urls.length > THUMB_COUNT
              ? `<button class="segment__more" data-cat="${key}">Prikaži sve (${c.urls.length})</button>`
              : ''
          }
        </div>
      </article>`;
  }).join('');

  // Wire crossfade hover on each square.
  container.querySelectorAll('.segment__square').forEach((sq) => {
    const key = sq.dataset.cat;
    const c = categories[key];
    const front = sq.querySelector('.is-front');
    const back = sq.querySelector('.is-back');
    const swap = makeCrossfader(front, back, c.urls);
    let current = c.cover;
    sq.addEventListener('mouseenter', () => {
      const next = randomImage(key, current);
      current = next;
      swap(next);
    });
    sq.addEventListener('click', () => openLightbox(key, 0));
  });

  // Thumbnails + "Prikaži sve".
  container.querySelectorAll('.thumb').forEach((t) => {
    t.addEventListener('click', () => openLightbox(t.dataset.cat, Number(t.dataset.index)));
  });
  container.querySelectorAll('.segment__more').forEach((m) => {
    m.addEventListener('click', () => openLightbox(m.dataset.cat, 0));
  });
}

/* ----------------------------------------------------------------------------
   Lightbox (per-category)
---------------------------------------------------------------------------- */
export function createLightbox(root) {
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <div class="lightbox__label"></div>
    <button class="lightbox__close" aria-label="Zatvori">×</button>
    <button class="lightbox__nav lightbox__prev" aria-label="Prethodna">‹</button>
    <img class="lightbox__img" src="" alt="" />
    <button class="lightbox__nav lightbox__next" aria-label="Sljedeća">›</button>
    <div class="lightbox__count"></div>
    <div class="lightbox__credit"></div>
  `;
  root.appendChild(el);

  const img = el.querySelector('.lightbox__img');
  const label = el.querySelector('.lightbox__label');
  const count = el.querySelector('.lightbox__count');
  const credit = el.querySelector('.lightbox__credit');
  let list = [];
  let currentKey = '';
  let i = 0;

  const render = () => {
    img.src = list[i];
    img.alt = altFor(currentKey, list[i], i);
    count.textContent = `${i + 1} / ${list.length}`;
    credit.innerHTML = creditHtml(creditFor(list[i]));
  };
  const open = (key, index) => {
    const c = categories[key];
    if (!c || !c.urls.length) return;
    list = c.urls;
    currentKey = key;
    i = Math.max(0, Math.min(index, list.length - 1));
    label.textContent = c.label;
    render();
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };
  const step = (d) => {
    i = (i + d + list.length) % list.length;
    render();
  };

  el.querySelector('.lightbox__close').addEventListener('click', close);
  el.querySelector('.lightbox__prev').addEventListener('click', () => step(-1));
  el.querySelector('.lightbox__next').addEventListener('click', () => step(1));
  el.addEventListener('click', (e) => {
    if (e.target === el) close();
  });
  window.addEventListener('keydown', (e) => {
    if (!el.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  // Touch swipe.
  let startX = 0;
  el.addEventListener('touchstart', (e) => (startX = e.changedTouches[0].clientX), { passive: true });
  el.addEventListener(
    'touchend',
    (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    },
    { passive: true }
  );

  return open;
}
