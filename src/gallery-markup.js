// Gallery markup, rendered once at build time and shared with the browser.
//
// This module is deliberately pure: no DOM, no `virtual:gallery` import, no
// module-scope locale lookup. That is what lets `plugins/gallery-manifest.js`
// import it from Node and emit the grid into index.html per locale, while
// `src/gallery.js` imports the same helpers for the parts that stay dynamic
// (the lightbox strip, the hover panel, the destination cards).
//
// Manifest entries are descriptors: { src, w, h, avif, webp, jpeg } with
// pre-joined srcsets. `t` is one locale dictionary out of `src/i18n/ui.js`.

export function base(url) {
  return url.split('/').pop();
}

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// Category order is fixed; the labels come from the active locale.
export const CATEGORY_KEYS = ['eksterijer', 'dnevni', 'kuhinja', 'sobe', 'kupatila', 'vlasic', 'travnik'];

export const THUMB_COUNT = 6;

export const COVER_SIZES = '(max-width: 1240px) 100vw, 1180px';
export const THUMB_SIZES = '(max-width: 540px) 62px, 78px';
export const LB_THUMB_SIZES = '(max-width: 540px) 56px, 72px';

// Cover image: a scene-* file, then a front-* file, else the first. The villa
// categories deliberately use neither prefix, so their curated `00-*` file — the
// alphabetically first — becomes the cover.
export function pickCover(photos) {
  return (
    photos.find((p) => base(p.src).startsWith('scene-')) ||
    photos.find((p) => base(p.src).startsWith('front-')) ||
    photos[0] ||
    null
  );
}

/**
 * Drop srcset candidates wider than `maxWidth`.
 *
 * The thumbnails are laid out at 62–78 px but carry the full 320/640/1280
 * ladder. The browser never picks the wide ones, so this costs nothing at
 * runtime — but with the grid now baked into the HTML those unused URLs are
 * ~500 bytes each, on the critical path, thirty-nine times over.
 */
export function narrow(srcset, maxWidth) {
  return srcset
    .split(', ')
    .filter((c) => {
      const w = Number(c.trim().split(/\s+/).pop().replace(/w$/, ''));
      return !w || w <= maxWidth;
    })
    .join(', ');
}

/* ----------------------------------------------------------------------------
   Alt text
   Derived from the curated filename — the patterns matched are the Bosnian
   filenames, which are locale-independent, while the text returned is not.
   Generic alt ("Smještaj 3") is worthless to screen readers and invisible to
   image search, and these photos are the main thing a guest wants to see.
---------------------------------------------------------------------------- */
function buildAlts(manifest, t, key) {
  const photos = manifest[key] || [];
  const build = t.alt[key];
  const textFor = (p) => {
    const name = base(p.src).replace(/\.[a-z]+$/i, '');
    return build ? build(name) : t.categories[key] || '';
  };

  const texts = photos.map(textFor);
  const total = new Map();
  for (const text of texts) total.set(text, (total.get(text) ?? 0) + 1);

  // Keep every alt distinct: repeated alt text is a quality signal against you.
  // But number only the ones that actually repeat — the builders read the detail
  // out of the curated filename, so most photos are already unique and a blanket
  // "— fotografija 4" on them is noise a screen reader has to sit through.
  const seen = new Map();
  const out = new Map();
  photos.forEach((p, idx) => {
    const text = texts[idx];
    if (total.get(text) === 1) {
      out.set(p.src, text);
      return;
    }
    const n = (seen.get(text) ?? 0) + 1;
    seen.set(text, n);
    out.set(p.src, n === 1 ? text : `${text}${t.photoSuffix(n)}`);
  });
  return out;
}

/**
 * `altFor(key, src)` for one manifest/locale pair.
 *
 * Computed per category and cached: the numbering above has to look at all of a
 * category's photos, not just the one being rendered.
 */
export function makeAlts(manifest, t) {
  const cache = new Map();
  return (key, src) => {
    let alts = cache.get(key);
    if (!alts) {
      alts = buildAlts(manifest, t, key);
      cache.set(key, alts);
    }
    return alts.get(src) ?? '';
  };
}

/* ----------------------------------------------------------------------------
   <picture> rendering
---------------------------------------------------------------------------- */
export function pictureHtml(p, { cls, sizes, alt, eager = false, maxWidth = 0 }) {
  if (!p) return '';
  const cut = (set) => (maxWidth ? narrow(set, maxWidth) : set);
  return `<picture>
      <source type="image/avif" srcset="${cut(p.avif)}" sizes="${sizes}" />
      <source type="image/webp" srcset="${cut(p.webp)}" sizes="${sizes}" />
      <img class="${cls}" src="${p.src}" srcset="${cut(p.jpeg)}" sizes="${sizes}"
           width="${p.w}" height="${p.h}" alt="${esc(alt)}"
           loading="${eager ? 'eager' : 'lazy'}" decoding="async"${
             eager ? ' fetchpriority="high"' : ''
           } />
    </picture>`;
}

/* ----------------------------------------------------------------------------
   The segment grid
   Rendered at build time into #gallery-segments, once per locale. src/gallery.js
   attaches behaviour to this markup and never rebuilds it — one renderer, so the
   static and runtime versions cannot drift apart.
---------------------------------------------------------------------------- */

// Thumbs are laid out at 78 px, so 640w covers even a 4× display.
const THUMB_MAX_WIDTH = 640;

export function segmentsHtml(manifest, t) {
  const altFor = makeAlts(manifest, t);

  return CATEGORY_KEYS.filter((key) => (manifest[key] || []).length)
    .map((key) => {
      const photos = manifest[key];
      const label = t.categories[key];
      const cover = pickCover(photos);
      const thumbs = photos.slice(0, THUMB_COUNT);
      return `
      <article class="segment reveal" data-cat="${key}">
        <button class="segment__square" data-cat="${key}" aria-label="${esc(t.openGallery(label))}">
          ${pictureHtml(cover, {
            cls: 'segment__layer is-front',
            sizes: COVER_SIZES,
            alt: altFor(key, cover.src),
          })}
          ${pictureHtml(cover, { cls: 'segment__layer is-back', sizes: COVER_SIZES, alt: '' })}
          <span class="segment__overlay">
            <span class="segment__title">${label}</span>
            <span class="segment__count">${t.photoCount(photos.length)}</span>
          </span>
        </button>
        <div class="segment__thumbs">
          ${thumbs
            .map(
              (p, i) => `
            <button class="thumb" data-cat="${key}" data-index="${i}" aria-label="${esc(
              t.openPhoto(i + 1, photos.length)
            )}">
              ${pictureHtml(p, {
                cls: '',
                sizes: THUMB_SIZES,
                alt: altFor(key, p.src),
                maxWidth: THUMB_MAX_WIDTH,
              })}
            </button>`
            )
            .join('')}
          ${
            photos.length > THUMB_COUNT
              ? `<button class="segment__more" data-cat="${key}">${esc(
                  t.showAll(photos.length)
                )}</button>`
              : ''
          }
        </div>
      </article>`;
    })
    .join('');
}
