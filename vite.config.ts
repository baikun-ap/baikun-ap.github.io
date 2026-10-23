import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Served from https://<user>.github.io/hanzi-trainer/ - override with BASE_PATH for other hosts.
// Two pages: the landing (index.html, plain HTML) and the course app (app/index.html).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/hanzi-trainer/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, 'index.html'),
        app: resolve(import.meta.dirname, 'app/index.html'),
      },
    },
  },
});
