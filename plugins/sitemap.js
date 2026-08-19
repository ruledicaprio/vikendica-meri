// Generate sitemap.xml, with an image entry for every photo.
//
// This replaces a hand-written public/sitemap.xml. Two things made that one a
// liability: the origin was hardcoded, so the domain move would have missed it,
// and <lastmod> was a date somebody had to remember to bump. Both come from the
// build now.
//
// The image entries are the point. The gallery grid in the HTML reaches 46 of
// the 60 photos — the cover and first six thumbs of each category — and the rest
// only exist inside the lightbox. Listing them here gets every one into image
// search at no cost to page weight. Only <image:loc> is emitted: Google dropped
// support for image:caption, image:title, image:license and image:geo_location
// in 2022, so the alt text belongs in the HTML and nowhere else.
import fs from 'node:fs';
import path from 'node:path';
import { LOCALES, DEFAULT_LOCALE } from '../src/i18n/page.js';
import { CATEGORIES } from './gallery-manifest.js';
import { siteOrigin } from './lib/origin.js';

function listPhotos(root) {
  const out = [];
  for (const cat of CATEGORIES) {
    let files = [];
    try {
      files = fs.readdirSync(path.join(root, 'public', cat));
    } catch {
      continue;
    }
    for (const f of files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
      if (/\.(jpe?g|png)$/i.test(f)) out.push(`/${cat}/${f}`);
    }
  }
  return out;
}

const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Percent-encode the path segments without touching the separators, so a photo
// whose name ever picks up a space or a diacritic still yields a valid <loc>.
const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

export function sitemap() {
  let root;
  let isBuild = false;

  return {
    name: 'vikendica-sitemap',

    configResolved(config) {
      root = config.root;
      isBuild = config.command === 'build';
    },

    generateBundle() {
      if (!isBuild) return;

      const origin = siteOrigin(root);
      const lastmod = new Date().toISOString().slice(0, 10);
      const photos = listPhotos(root).map((p) => `${origin}${encodePath(p)}`);

      // Every locale lists every other as an alternate, x-default included —
      // the same set the <link rel="alternate"> tags in index.html carry.
      const alternates = Object.entries(LOCALES)
        .map(
          ([name, d]) =>
            `    <xhtml:link rel="alternate" hreflang="${name}" href="${origin}${d.path}" />`
        )
        .concat(
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${origin}${LOCALES[DEFAULT_LOCALE].path}" />`
        )
        .join('\n');

      const images = photos
        .map((url) => `    <image:image><image:loc>${xmlEscape(url)}</image:loc></image:image>`)
        .join('\n');

      const urls = Object.entries(LOCALES)
        .map(
          ([name, d]) => `  <url>
    <loc>${origin}${d.path}</loc>
${alternates}
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${name === DEFAULT_LOCALE ? '1.0' : '0.9'}</priority>
${images}
  </url>`
        )
        .join('\n');

      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
>
${urls}
</urlset>
`,
      });
    },
  };
}
