import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

/**
 * Where the app lives: GitHub Pages serves it under /gym-log/, hosts with their own
 * (sub)domain — Netlify, Vercel, Cloudflare Pages — at the root. BASE_PATH overrides.
 */
const base = process.env.BASE_PATH ?? (process.env.NETLIFY || process.env.VERCEL || process.env.CF_PAGES ? '/' : '/gym-log/');

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Gym Log',
        short_name: 'Gym Log',
        description: 'Free workout tracker',
        theme_color: '#090909',
        background_color: '#090909',
        display: 'standalone',
        orientation: 'portrait',
        id: base,
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json,woff2}'],
        globIgnores: ['splash/**', 'icons/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/gh\/yuhonas\/free-exercise-db/,
            handler: 'CacheFirst',
            options: {
              // CORS responses only: opaque (no-cors) ones are counted as ~7 MB each by browsers
              // and quickly fill the storage quota, which then breaks saving workouts
              cacheName: 'exercise-images-v2',
              expiration: { maxEntries: 2000 },
              cacheableResponse: { statuses: [200] },
              fetchOptions: { mode: 'cors' },
            },
          },
        ],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1500 },
  test: { environment: 'node' },
});
