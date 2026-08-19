// Renders index.html once per locale.
//
// index.html is the Vite entry and carries {{key}} placeholders. Substitution
// happens in `transformIndexHtml`, which knows from the request path which
// locale is being served, so dev and build take the same code path. At build
// time the post-processed HTML — assets already injected — is re-rendered for
// every non-default locale and emitted alongside the default one.
//
// The point of doing it here rather than by hand is the validation: a key that
// is missing from a locale, or present in a locale but never used, fails the
// build. Two hand-maintained HTML files would silently drift instead.
import fs from 'node:fs';
import path from 'node:path';
import { LOCALES, DEFAULT_LOCALE } from '../src/i18n/page.js';

const TOKEN = /\{\{(\w+)\}\}/g;

// Read directly rather than substituted through a placeholder.
const STRUCTURAL = new Set(['path']);

/** Substitute {{key}} against `dict`, failing loudly on any mismatch. */
export function render(html, dict, localeName) {
  const used = new Set();
  const missing = new Set();

  const out = html.replace(TOKEN, (_, key) => {
    if (!(key in dict)) {
      missing.add(key);
      return '';
    }
    used.add(key);
    return dict[key];
  });

  if (missing.size) {
    throw new Error(
      `[i18n] locale "${localeName}" is missing ${missing.size} key(s) used in index.html: ` +
        [...missing].sort().join(', ')
    );
  }
  const unused = Object.keys(dict).filter((k) => !used.has(k) && !STRUCTURAL.has(k));
  if (unused.length) {
    throw new Error(
      `[i18n] locale "${localeName}" defines ${unused.length} key(s) that index.html never uses: ` +
        unused.sort().join(', ')
    );
  }
  return out;
}

/**
 * Is this the public site's entry?
 *
 * transformIndexHtml fires for every HTML entry, and the build has a second one
 * — manager/index.html, the owner panel. Without this guard the validator sees a
 * document containing no {{key}} at all and correctly reports every key as
 * unused, failing the build. The guard narrows the plugin to its one template;
 * it does not weaken the checks on that template.
 */
function isSiteEntry(ctx) {
  if (ctx?.filename) return /(^|[\\/])index\.html$/.test(ctx.filename) && !/manager/.test(ctx.filename);
  const p = ctx?.path || '/';
  return !p.startsWith('/manager');
}

/** Which locale a request path belongs to. */
function localeFor(urlPath) {
  const hit = Object.entries(LOCALES).find(
    ([name, d]) => name !== DEFAULT_LOCALE && (urlPath === d.path || urlPath === `${d.path}index.html`)
  );
  return hit ? hit[0] : DEFAULT_LOCALE;
}

/**
 * @param {object} [options]
 * @param {Record<string, (localeName: string) => string | Promise<string>>} [options.computed]
 *   Keys whose value is produced at build time rather than written by hand in
 *   page.js — the gallery grid, which is rendered per locale from the photo
 *   manifest. Merged over the locale dictionary, so the validation above covers
 *   them exactly as it covers the static keys.
 */
export function i18nHtml({ computed = {} } = {}) {
  let root = process.cwd();
  let templateHtml = '';

  /** The locale dictionary with the computed keys resolved into it. */
  const dictFor = async (name) => {
    const extra = {};
    for (const [key, fn] of Object.entries(computed)) extra[key] = await fn(name);
    return { ...LOCALES[name], ...extra };
  };

  return {
    name: 'i18n-html',

    configResolved(config) {
      root = config.root;
    },

    transformIndexHtml: {
      // `post` so the HTML already has the hashed script/style tags injected —
      // the alternate locales then inherit them without a second pass.
      order: 'post',
      async handler(html, ctx) {
        if (!isSiteEntry(ctx)) return html;
        // Stash the un-substituted form for generateBundle.
        templateHtml = html;
        const name = localeFor(ctx?.path || '/');
        return render(html, await dictFor(name), name);
      },
    },

    generateBundle: {
      // `post`, because vite:build-html renders index.html in its own
      // generateBundle — without this ours runs first and templateHtml is still
      // empty, which the validator correctly reports as "every key unused".
      order: 'post',
      async handler() {
        for (const [name, dict] of Object.entries(LOCALES)) {
          if (name === DEFAULT_LOCALE) continue;
          this.emitFile({
            type: 'asset',
            fileName: `${dict.path.replace(/^\/|\/$/g, '')}/index.html`,
            source: render(templateHtml, await dictFor(name), name),
          });
        }
      },
    },

    // Dev server: serve the alternate locales from their own paths so /en/ is
    // browsable without a build. transformIndexHtml above sees the /en/ path
    // and substitutes accordingly.
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlPath = (req.url || '').split('?')[0];
        if (localeFor(urlPath) === DEFAULT_LOCALE) return next();
        try {
          const raw = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
          const html = await server.transformIndexHtml(urlPath, raw, req.originalUrl);
          res.setHeader('Content-Type', 'text/html');
          res.end(html);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}
