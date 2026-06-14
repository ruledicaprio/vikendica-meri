import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Build-time manifest of the photos in /public/<category>/.
// They are served as stable, cacheable URLs at /<category>/<file> (dev + build)
// — good for SEO/caching — and are NOT re-bundled/duplicated by Vite.
function galleryManifest() {
  const virtualId = 'virtual:gallery';
  const resolvedId = '\0' + virtualId;
  const categories = ['smjestaj', 'vlasic', 'travnik'];

  const build = () => {
    const pub = path.resolve(process.cwd(), 'public');
    const data = {};
    for (const cat of categories) {
      let files = [];
      try {
        files = fs
          .readdirSync(path.join(pub, cat))
          .filter((f) => /\.(jpe?g|png)$/i.test(f))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      } catch {
        files = [];
      }
      data[cat] = files.map((f) => `/${cat}/${f}`);
    }
    return data;
  };

  return {
    name: 'vikendica-gallery-manifest',
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id === resolvedId) {
        return `export const manifest = ${JSON.stringify(build())};`;
      }
    },
  };
}

export default defineConfig({
  plugins: [galleryManifest()],
  server: {
    // Honour a PORT assigned by the environment (e.g. preview harness),
    // otherwise default to Vite's 5173.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    open: false,
  },
  build: { outDir: 'dist' },
});
