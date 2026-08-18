// Segmented gallery + lightbox.
//
// Masters live in /public/<cat>/ and are served at /<cat>/ as stable, cacheable
// URLs. Responsive AVIF/WebP variants are generated at build time and served
// from /img/<cat>/. Both come from the `virtual:gallery` manifest, whose entries
// are descriptors: { src, w, h, avif, webp, jpeg } with pre-joined srcsets.
import { manifest } from 'virtual:gallery';
import { creditFor, creditHtml } from './credits.js';

function base(url) {
  return url.split('/').pop();
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// Cover image: a scene-* file, then a front-* file, else the first. The villa
// categories deliberately use neither prefix, so their curated `00-*` file — the
// alphabetically first — becomes the cover.
function pickCover(photos) {
  return (
    photos.find((p) => base(p.src).startsWith('scene-')) ||
    photos.find((p) => base(p.src).startsWith('front-')) ||
    photos[0] ||
    null
  );
}

const META = {
  eksterijer: { label: 'Eksterijer' },
  dnevni: { label: 'Dnevni boravak' },
  kuhinja: { label: 'Kuhinja' },
  sobe: { label: 'Sobe' },
  kupatila: { label: 'Kupatila' },
  vlasic: { label: 'Planina Vlašić' },
  travnik: { label: 'Travnik' },
};

/* ----------------------------------------------------------------------------
   Alt text
   Derived from the curated filename. Generic alt ("Smještaj 3") is worthless to
   screen readers and invisible to image search, and these photos are the main
   thing a guest actually wants to see.
---------------------------------------------------------------------------- */
const ALT = {
  eksterijer: (n) => {
    if (/terasa/.test(n)) return 'Terasa vikendice Meri sa roštiljem, Babanovac';
    if (/dvoriste/.test(n)) return 'Dvorište vikendice Meri sa roštiljem i sjedenjem';
    if (/ulaz/.test(n)) return 'Ulaz u vikendicu Meri, Dolina Panjeva';
    if (/okolina/.test(n)) return 'Okolina vikendice Meri na Babanovcu, planina Vlašić';
    if (/bocna/.test(n)) return 'Bočna strana A-frame vikendice Meri';
    if (/snijeg|zimski|zimi/.test(n)) return 'A-frame vikendica Meri pod snijegom, Babanovac';
    return 'A-frame vikendica Meri, Dolina Panjeva, Babanovac';
  },
  dnevni: (n) => {
    if (/trpezarija/.test(n)) return 'Trpezarija sa velikim stolom u vikendici Meri';
    if (/hodnik/.test(n)) return 'Hodnik i stepenice u vikendici Meri';
    return 'Dnevni boravak sa kaminom i TV-om u vikendici Meri';
  },
  kuhinja: (n) => {
    if (/sudoper/.test(n)) return 'Sudoper i radna ploča u kuhinji vikendice Meri';
    if (/stednjak/.test(n)) return 'Šporet i rerna u kuhinji vikendice Meri';
    if (/frizider/.test(n)) return 'Frižider i mikrovalna u kuhinji vikendice Meri';
    if (/radna-ploca|kutak/.test(n)) return 'Radni kutak u kuhinji vikendice Meri';
    return 'Potpuno opremljena kuhinja u vikendici Meri, Babanovac';
  },
  sobe: (n) => {
    if (/bracna/.test(n)) return 'Bračna soba sa balkonom na 1. spratu vikendice Meri';
    if (/djecija/.test(n)) return 'Dječija soba na 1. spratu vikendice Meri';
    if (/druga/.test(n)) return 'Spavaća soba sa dva ležaja na 2. spratu vikendice Meri';
    return 'Spavaća soba sa balkonom na 2. spratu vikendice Meri';
  },
  kupatila: (n) =>
    /prizemlje/.test(n)
      ? 'Kupatilo u prizemlju vikendice Meri sa tuš kabinom'
      : 'Kupatilo na spratu vikendice Meri sa tuš kabinom',
  vlasic: (n) => {
    if (/galica/.test(n)) return 'Pogled na Galicu, planina Vlašić';
    if (/ugar/.test(n)) return 'Pogled na Ugar, planina Vlašić';
    return 'Planina Vlašić i Babanovac';
  },
  travnik: () => 'Grad Travnik, centralna Bosna',
};

function altFor(key, src, i) {
  const name = base(src).replace(/\.[a-z]+$/i, '');
  const build = ALT[key];
  const text = build ? build(name) : META[key]?.label || '';
  // Keep every alt distinct: repeated alt text is a quality signal against you.
  return i > 0 ? `${text} — fotografija ${i + 1}` : text;
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
    const photos = manifest[key] || [];
    return [key, { key, label: META[key].label, photos, cover: pickCover(photos) }];
  })
);

export function getCategory(key) {
  return categories[key];
}

/** Random photo from a category (≠ current, when possible). */
export function randomImage(key, excludeSrc) {
  const photos = categories[key]?.photos || [];
  if (photos.length === 0) return null;
  if (photos.length === 1) return photos[0];
  let pick = null;
  let guard = 0;
  while ((!pick || pick.src === excludeSrc) && guard++ < 10) {
    pick = photos[Math.floor(Math.random() * photos.length)];
  }
  return pick;
}

/* ----------------------------------------------------------------------------
   <picture> rendering
---------------------------------------------------------------------------- */
const COVER_SIZES = '(max-width: 1240px) 100vw, 1180px';
const THUMB_SIZES = '(max-width: 540px) 62px, 78px';

function pictureHtml(p, { cls, sizes, alt, eager = false }) {
  if (!p) return '';
  return `<picture>
      <source type="image/avif" srcset="${p.avif}" sizes="${sizes}" />
      <source type="image/webp" srcset="${p.webp}" sizes="${sizes}" />
      <img class="${cls}" src="${p.src}" srcset="${p.jpeg}" sizes="${sizes}"
           width="${p.w}" height="${p.h}" alt="${esc(alt)}"
           loading="${eager ? 'eager' : 'lazy'}" decoding="async"${
             eager ? ' fetchpriority="high"' : ''
           } />
    </picture>`;
}

/** Point an existing <picture> at a different photo. */
function setSources(pic, p) {
  const sources = pic.querySelectorAll('source');
  if (sources[0]) sources[0].srcset = p.avif;
  if (sources[1]) sources[1].srcset = p.webp;
  const img = pic.querySelector('img');
  // <source srcset> is only re-evaluated on mutation, so both must be set —
  // changing img.src alone would silently keep the previous AVIF.
  img.srcset = p.jpeg;
  img.src = p.src;
  img.width = p.w;
  img.height = p.h;
  return img;
}

/* ----------------------------------------------------------------------------
   Crossfade helper for a two-layer square
---------------------------------------------------------------------------- */
function makeCrossfader(frontPic, backPic, photos) {
  let showingBack = false;
  return async (next) => {
    if (!next || photos.length < 2) return;
    const showPic = showingBack ? frontPic : backPic;
    const hidePic = showingBack ? backPic : frontPic;
    const showImg = setSources(showPic, next);
    // decode() (unlike onload) guarantees the frame is ready to paint, which
    // matters for the larger AVIFs — otherwise the swap can visibly hitch.
    try {
      await showImg.decode();
    } catch {
      /* decode can reject on abort; show it anyway */
    }
    showImg.style.opacity = '1';
    hidePic.querySelector('img').style.opacity = '0';
    showingBack = !showingBack;
  };
}

/** Two crossfade layers in `el`, swapping to a random photo on hover. */
export function attachHoverSwap(el, key) {
  const c = categories[key];
  if (!c || !c.cover) return;
  const alt = altFor(key, c.cover.src, 0);
  el.innerHTML =
    pictureHtml(c.cover, { cls: 'media-layer is-front', sizes: '(max-width: 900px) 100vw, 50vw', alt }) +
    pictureHtml(c.cover, { cls: 'media-layer is-back', sizes: '(max-width: 900px) 100vw, 50vw', alt: '' });

  const pics = el.querySelectorAll('picture');
  const swap = makeCrossfader(pics[0], pics[1], c.photos);
  let current = c.cover.src;
  el.addEventListener('mouseenter', () => {
    const next = randomImage(key, current);
    if (!next) return;
    current = next.src;
    swap(next);
  });
}

/* ----------------------------------------------------------------------------
   Hover previews for the floor cards and amenity chips
   Each [data-photo] element names one photo as "<cat>/<file>". A single shared
   panel is repointed on hover rather than one panel per element: 17 targets
   would otherwise put 17 more <picture> trees in the DOM for a decoration.
---------------------------------------------------------------------------- */
const PREVIEW_SIZES = '240px';

/** Resolve "kuhinja/05-….jpg" against the manifest. Throws — see initHoverPreviews. */
export function findPhoto(path) {
  const [cat, file] = String(path).split('/');
  return (manifest[cat] || []).find((p) => base(p.src) === file) || null;
}

export function initHoverPreviews(root = document) {
  const targets = root.querySelectorAll('[data-photo]');
  if (!targets.length) return;

  // Hover is a pointing-device affordance. On touch there is no hover to leave,
  // so the panel would stick after a tap and cover the text it belongs to.
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const panel = document.createElement('div');
  panel.className = 'hover-preview';
  // Decorative: the chip's own text is the accessible name, and the photo adds
  // nothing a screen reader needs.
  panel.setAttribute('aria-hidden', 'true');

  // Resolve everything up front so a typo in data-photo fails at load, loudly,
  // instead of silently doing nothing the first time someone hovers.
  const photos = new Map();
  for (const el of targets) {
    const key = el.dataset.photo;
    const p = findPhoto(key);
    if (!p) throw new Error(`[hover-preview] no photo matches data-photo="${key}"`);
    photos.set(el, p);
  }

  const first = photos.values().next().value;
  panel.innerHTML = pictureHtml(first, { cls: 'hover-preview__img', sizes: PREVIEW_SIZES, alt: '' });
  document.body.appendChild(panel);
  const pic = panel.querySelector('picture');
  const img = panel.querySelector('img');
  // The panel is visibility:hidden until hovered, and Chrome never starts a
  // lazy fetch for a hidden image — not for this one, and not for the swaps
  // either, so the panel would stay permanently blank. It is one 320w AVIF
  // (~8 KB), and loading it up front makes the first hover instant.
  img.loading = 'eager';

  const place = (el) => {
    const r = el.getBoundingClientRect();
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const gap = 12;
    // Prefer the right of the element, flip to the left when it would overflow.
    let x = r.right + gap;
    if (x + w > window.innerWidth - gap) x = r.left - w - gap;
    x = Math.max(gap, Math.min(x, window.innerWidth - w - gap));
    const y = Math.max(gap, Math.min(r.top, window.innerHeight - h - gap));
    panel.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };

  const show = (el) => {
    const p = photos.get(el);
    if (!p) return;
    setSources(pic, p);
    // Portrait stays portrait: the panel takes the photo's own ratio rather
    // than the wide cover geometry the gallery squares use.
    img.style.aspectRatio = `${p.w} / ${p.h}`;
    panel.classList.add('is-visible');
    place(el);
  };
  const hide = () => panel.classList.remove('is-visible');

  for (const el of targets) {
    el.addEventListener('pointerenter', () => show(el));
    el.addEventListener('pointerleave', hide);
    el.addEventListener('focus', () => show(el));
    el.addEventListener('blur', hide);
  }
  window.addEventListener('scroll', hide, { passive: true });
}

/* ----------------------------------------------------------------------------
   Build segments
---------------------------------------------------------------------------- */
const ORDER = ['eksterijer', 'dnevni', 'kuhinja', 'sobe', 'kupatila', 'vlasic', 'travnik'];
const THUMB_COUNT = 6;

export function initGallery(container, openLightbox) {
  container.innerHTML = ORDER.filter((key) => categories[key]?.photos.length)
    .map((key) => {
      const c = categories[key];
      const thumbs = c.photos.slice(0, THUMB_COUNT);
      return `
      <article class="segment reveal" data-cat="${key}">
        <button class="segment__square" data-cat="${key}" aria-label="Otvori galeriju: ${c.label}">
          ${pictureHtml(c.cover, {
            cls: 'segment__layer is-front',
            sizes: COVER_SIZES,
            alt: altFor(key, c.cover.src, 0),
          })}
          ${pictureHtml(c.cover, { cls: 'segment__layer is-back', sizes: COVER_SIZES, alt: '' })}
          <span class="segment__overlay">
            <span class="segment__title">${c.label}</span>
            <span class="segment__count">${photoCount(c.photos.length)}</span>
          </span>
        </button>
        <div class="segment__thumbs">
          ${thumbs
            .map(
              (p, i) => `
            <button class="thumb" data-cat="${key}" data-index="${i}" aria-label="Otvori fotografiju ${
              i + 1
            } od ${c.photos.length}">
              ${pictureHtml(p, { cls: '', sizes: THUMB_SIZES, alt: altFor(key, p.src, i) })}
            </button>`
            )
            .join('')}
          ${
            c.photos.length > THUMB_COUNT
              ? `<button class="segment__more" data-cat="${key}">Prikaži sve (${c.photos.length})</button>`
              : ''
          }
        </div>
      </article>`;
    })
    .join('');

  // Wire crossfade hover on each square.
  container.querySelectorAll('.segment__square').forEach((sq) => {
    const key = sq.dataset.cat;
    const c = categories[key];
    const pics = sq.querySelectorAll('picture');
    const swap = makeCrossfader(pics[0], pics[1], c.photos);
    let current = c.cover.src;
    sq.addEventListener('mouseenter', () => {
      const next = randomImage(key, current);
      if (!next) return;
      current = next.src;
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
    <picture class="lightbox__pic">
      <source type="image/avif" srcset="" sizes="90vw" />
      <source type="image/webp" srcset="" sizes="90vw" />
      <img class="lightbox__img" src="" alt="" sizes="90vw" decoding="async" />
    </picture>
    <button class="lightbox__nav lightbox__next" aria-label="Sljedeća">›</button>
    <div class="lightbox__count"></div>
    <div class="lightbox__credit"></div>
  `;
  root.appendChild(el);

  const pic = el.querySelector('.lightbox__pic');
  const img = el.querySelector('.lightbox__img');
  const label = el.querySelector('.lightbox__label');
  const count = el.querySelector('.lightbox__count');
  const credit = el.querySelector('.lightbox__credit');
  let list = [];
  let currentKey = '';
  let i = 0;

  const render = () => {
    const p = list[i];
    setSources(pic, p);
    img.alt = altFor(currentKey, p.src, i);
    // Reserve the box before the bytes arrive, otherwise every navigation reflows.
    img.style.aspectRatio = `${p.w} / ${p.h}`;
    count.textContent = `${i + 1} / ${list.length}`;
    credit.innerHTML = creditHtml(creditFor(p.src));
    // Warm the likely next image.
    const next = list[(i + 1) % list.length];
    if (next && next !== p) new Image().srcset = next.webp;
  };
  // Where focus was before the dialog opened, so it can be given back.
  let opener = null;
  const focusables = () => [...el.querySelectorAll('button')];

  const open = (key, index) => {
    const c = categories[key];
    if (!c || !c.photos.length) return;
    list = c.photos;
    currentKey = key;
    i = Math.max(0, Math.min(index, list.length - 1));
    label.textContent = c.label;
    render();
    opener = document.activeElement;
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    el.querySelector('.lightbox__close').focus();
  };
  const close = () => {
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    // Returning focus to the thumb that opened it: without this, focus falls
    // back to <body> and a keyboard user restarts from the top of the page.
    if (opener && document.contains(opener)) opener.focus();
    opener = null;
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
    // aria-modal only tells assistive tech the rest is inert; Tab still walks
    // out into the page behind, so the cycle has to be closed by hand.
    if (e.key === 'Tab') {
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!el.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
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
