import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { assetLinks } from './plugins/asset-links.js';
import { galleryManifest } from './plugins/gallery-manifest.js';
import { i18nHtml } from './plugins/i18n-html.js';

export default defineConfig({
  plugins: [assetLinks(), galleryManifest(), i18nHtml()],
  server: {
    // Honour a PORT assigned by the environment (e.g. preview harness),
    // otherwise default to Vite's 5173.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        // The public site. i18n-html renders this one per locale.
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        // The owner-only manager panel, served at /manager/ behind Cloudflare
        // Access. Untranslated and deliberately outside the i18n pipeline.
        manager: fileURLToPath(new URL('./manager/index.html', import.meta.url)),
      },
    },
  },
});
