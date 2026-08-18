import { defineConfig } from 'vite';
import { galleryManifest } from './plugins/gallery-manifest.js';

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
