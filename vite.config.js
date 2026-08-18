import { defineConfig } from 'vite';
import { galleryManifest } from './plugins/gallery-manifest.js';
import { i18nHtml } from './plugins/i18n-html.js';

export default defineConfig({
  plugins: [galleryManifest(), i18nHtml()],
  server: {
    // Honour a PORT assigned by the environment (e.g. preview harness),
    // otherwise default to Vite's 5173.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    open: false,
  },
  build: { outDir: 'dist' },
});
