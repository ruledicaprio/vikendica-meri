// The site's origin, read from <link rel="canonical"> in index.html.
//
// Two plugins need it — asset-links to resolve the URLs hardcoded in the JSON-LD,
// sitemap to write absolute <loc> entries — and the site is moving to
// vikendica-meri.com once the domain is bought. Reading it from the one place it
// is already declared keeps that a single-line change instead of a hunt.
import fs from 'node:fs';
import path from 'node:path';

export function siteOrigin(root) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  // Stops at `{` so the {{path}} placeholder after the origin is excluded.
  const canonical = html.match(/<link rel="canonical" href="(https?:\/\/[^"{]+)/);
  if (!canonical) {
    throw new Error('[origin] no <link rel="canonical"> in index.html — cannot resolve the site origin');
  }
  return canonical[1].replace(/\/$/, '');
}
