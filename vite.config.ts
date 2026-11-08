import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// Served from https://baikun-ap.github.io/ — override with BASE_PATH for other hosts.
// Two pages: the landing (index.html, plain HTML) and the course app (app/index.html).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  // Bklit charts and Kokonut UI import from "@/…" (src).
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, 'index.html'),
        app: resolve(import.meta.dirname, 'app/index.html'),
        fernhollow: resolve(import.meta.dirname, 'fernhollow/index.html'),
      },
    },
  },
});
