// Fail the build when index.html points at a file that is not there.
//
// The JSON-LD graph names ten assets by absolute URL — five in the LodgingBusiness
// `image` array, five more as ImageObject/VideoObject contentUrls — plus og:image
// and the hero poster. None of them go through the module graph, so Vite has no
// idea they exist: delete one of those photos and the build stays green while the
// structured data quietly points at a 404. Nobody finds out until Search Console
// complains weeks later, if ever.
//
// The origin is read from <link rel="canonical"> rather than hardcoded, so this
// keeps working the day the site moves to vikendica-meri.com.
import fs from 'node:fs';
import path from 'node:path';
import { siteOrigin } from './lib/origin.js';

const MEDIA = /\.(jpe?g|png|webp|avif|svg|ico|mp4|webm|xml|txt|webmanifest)$/i;

export function assetLinks() {
  let root;

  return {
    name: 'vikendica-asset-links',

    configResolved(config) {
      root = config.root;
    },

    buildStart() {
      const htmlPath = path.join(root, 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');

      const origin = siteOrigin(root);

      // Same-origin absolute URLs that look like files, deduped: several photos
      // appear both in the image array and as an ImageObject. Split on the origin
      // rather than building a RegExp out of it — the origin is a URL full of
      // regex metacharacters, and escaping it inside a template literal is how
      // this check silently matched nothing the first time round.
      const urls = new Set();
      for (const chunk of html.split(origin).slice(1)) {
        const stop = chunk.search(/["'\s>]/);
        const url = (stop === -1 ? chunk : chunk.slice(0, stop)).split('#')[0].split('?')[0];
        if (url.startsWith('/') && MEDIA.test(url)) urls.add(url);
      }

      const missing = [];
      for (const url of urls) {
        if (!fs.existsSync(path.join(root, 'public', decodeURIComponent(url)))) missing.push(url);
      }

      if (missing.length) {
        throw new Error(
          `[asset-links] index.html references ${missing.length} file(s) missing from public/:\n` +
            missing.map((m) => `  ${m}`).join('\n') +
            '\nEither restore them or update the reference — a 404 here is a broken image ' +
            'in the structured data, which fails silently in production.'
        );
      }
    },
  };
}
