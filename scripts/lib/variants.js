// Single definition of the responsive-image matrix, shared by the ingest script
// and the Vite manifest plugin so the two can never disagree about widths,
// quality or filenames.
//
// Variants are build artifacts: they live in a gitignored, content-hash-keyed
// cache and are copied into dist/img/ at build time. Committing ~50 MB of
// binaries would make every photo tweak an enormous diff; regenerating from
// scratch on every deploy would be wasteful. The cache gives both a bounded
// cold build and free warm ones.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export const CACHE_DIR = '.image-cache';

export const WIDTHS = [320, 640, 1280, 1920];

// AVIF and WebP across the full ladder; a single JPEG at 1280 as the fallback
// for anything that supports neither. The committed 2200px master stays the
// top entry of the JPEG srcset, so no second large JPEG is generated.
// AVIF `effort` is measured, not guessed: on this photo set effort 4 costs 5144ms
// per photo against 823ms at effort 2 — 6x the time for a byte-identical 49KB
// output. Anything above 2 is pure build-time waste here.
export const FORMATS = [
  { ext: 'avif', opts: { quality: 50, effort: 2 }, widths: WIDTHS },
  { ext: 'webp', opts: { quality: 74 }, widths: WIDTHS },
  { ext: 'jpg', opts: { quality: 78, mozjpeg: true }, widths: [1280] },
];

export const hashOf = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 8);

/** Content-hashed name, so /img/* can be cached immutably for a year. */
export const variantName = (base, hash, w, ext) => `${base}.${hash}-${w}.${ext}`;

/** Run `jobs` with at most `n` in flight. AVIF encoding is the slow part. */
export async function pool(n, items, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    })
  );
  return out;
}

/**
 * Ensure every variant of `absSrc` exists in the cache, and describe it.
 *
 * Returns pre-joined srcset strings rather than nested arrays: it keeps
 * gallery.js dumb and the manifest payload small.
 */
export async function ensureVariants(absSrc, cat, root) {
  const file = path.basename(absSrc);
  const base = file.replace(/\.[^.]+$/, '');
  const buf = fs.readFileSync(absSrc);
  const hash = hashOf(buf);

  // `.rotate()` first: dimensions must be the displayed ones, not the stored
  // ones, or every EXIF-rotated photo gets a transposed width/height attribute.
  const img = sharp(buf).rotate();
  const { width, height } = await img.metadata();

  const outDir = path.join(root, CACHE_DIR, cat);
  fs.mkdirSync(outDir, { recursive: true });

  const srcset = {};
  for (const { ext, opts, widths } of FORMATS) {
    const entries = [];
    for (const w of widths) {
      if (w > width) continue; // never upscale
      const name = variantName(base, hash, w, ext);
      const dest = path.join(outDir, name);
      if (!fs.existsSync(dest)) {
        const tmp = `${dest}.tmp`;
        await sharp(buf)
          .rotate()
          .resize({ width: w, withoutEnlargement: true })
          .toFormat(ext === 'jpg' ? 'jpeg' : ext, opts)
          .toFile(tmp);
        fs.renameSync(tmp, dest);
      }
      entries.push(`/img/${cat}/${name} ${w}w`);
    }
    srcset[ext] = entries;
  }

  const src = `/${cat}/${file}`;
  // The uncompressed master closes the JPEG ladder at its true width.
  srcset.jpg.push(`${src} ${width}w`);

  return {
    src,
    w: width,
    h: height,
    avif: srcset.avif.join(', '),
    webp: srcset.webp.join(', '),
    jpeg: srcset.jpg.join(', '),
  };
}
