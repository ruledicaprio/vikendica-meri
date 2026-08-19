// Build-time manifest of the photos in /public/<category>/.
//
// Masters stay at stable, cacheable URLs (/<category>/<file>) and are never
// re-bundled by Vite. Alongside each one this plugin generates responsive
// AVIF/WebP/JPEG variants into a gitignored cache, serves them at /img/** in
// dev, and copies them into dist/img/ for the build.
import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR, ensureVariants, pool } from '../scripts/lib/variants.js';

const VIRTUAL_ID = 'virtual:gallery';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

// Display order — the gallery renders categories in this sequence.
export const CATEGORIES = [
  'eksterijer',
  'dnevni',
  'kuhinja',
  'sobe',
  'kupatila',
  'vlasic',
  'travnik',
];

const MIME = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

function listPhotos(root, cat) {
  try {
    return fs
      .readdirSync(path.join(root, 'public', cat))
      .filter((f) => /\.(jpe?g|png)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch {
    return [];
  }
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/**
 * Delete cached variants no photo points at any more.
 *
 * The cache is content-hash keyed, so it goes stale in two ways that both look
 * like nothing happening: deleting a photo from public/<cat>/ leaves its
 * variants behind, and *editing* one — re-saving it with an IPTC caption is
 * enough — changes the hash and orphans the whole previous set. Neither is
 * visible in git, because the cache is ignored. Left alone it only grows, and
 * closeBundle() copies every orphan into dist/img/.
 *
 * The live set is read back out of the srcset strings rather than threaded
 * through ensureVariants(), so the two cannot drift apart.
 */
function pruneCache(root, data) {
  let removed = 0;
  for (const [cat, photos] of Object.entries(data)) {
    const dir = path.join(root, CACHE_DIR, cat);
    if (!fs.existsSync(dir)) continue;

    const live = new Set();
    for (const ph of photos) {
      for (const set of [ph.avif, ph.webp, ph.jpeg]) {
        for (const m of set.matchAll(/\/img\/[^/]+\/([^\s,]+)/g)) live.add(m[1]);
      }
    }

    for (const name of fs.readdirSync(dir)) {
      if (live.has(name)) continue;
      fs.rmSync(path.join(dir, name), { force: true });
      removed++;
    }
  }
  // Worth a line: a large number here means photos were deleted or re-saved,
  // which is exactly when you want to know the gallery changed under you.
  if (removed) console.log(`[gallery] pruned ${removed} orphaned image variant(s)`);
}

export function galleryManifest() {
  let root;
  let isBuild = false;

  const build = async () => {
    const data = {};
    for (const cat of CATEGORIES) {
      const files = listPhotos(root, cat);
      // AVIF is the slow encode, so run a few in parallel.
      data[cat] = await pool(4, files, (f) =>
        ensureVariants(path.join(root, 'public', cat, f), cat, root)
      );
    }
    pruneCache(root, data);
    return data;
  };

  return {
    name: 'vikendica-gallery-manifest',

    configResolved(config) {
      root = config.root;
      isBuild = config.command === 'build';
    },

    configureServer(server) {
      // Serve generated variants straight out of the cache in dev.
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/img/')) return next();
        const rel = decodeURIComponent(req.url.slice(5).split('?')[0]);
        const file = path.join(root, CACHE_DIR, rel);
        if (!file.startsWith(path.join(root, CACHE_DIR)) || !fs.existsSync(file)) return next();
        res.setHeader('Content-Type', MIME[path.extname(file).slice(1)] || 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });

      // Dropping a photo into public/<cat>/ now shows up without a restart.
      const invalidate = (file) => {
        if (!/[\\/]public[\\/][^\\/]+[\\/][^\\/]+\.(jpe?g|png)$/i.test(file)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', invalidate).on('unlink', invalidate);
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },

    async load(id) {
      if (id === RESOLVED_ID) {
        return `export const manifest = ${JSON.stringify(await build())};`;
      }
    },

    // Copy by hand rather than emitFile(): these are not part of the module
    // graph, and emitting them would hold ~50 MB of buffers in the bundle.
    closeBundle() {
      if (!isBuild) return;
      copyDir(path.join(root, CACHE_DIR), path.join(root, 'dist', 'img'));
    },
  };
}
