/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.svg', 'favicon.svg'],
      manifest: {
        name: 'Howlnight — Party Narrator',
        short_name: 'Howlnight',
        description:
          'Pass-the-phone Werewolf / Mafia narrator for your party. No human moderator needed.',
        theme_color: '#121c33',
        background_color: '#121c33',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        lang: 'en',
        scope: '/',
        icons: [
          {
            src: 'icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,mp3,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Never cache analytics; NetworkOnly so offline/ad-block failures stay
        // out of the SW cache and do not break app shell offline mode.
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/gc\.zgo\.at\//i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https?:\/\/[^/]*goatcounter\.com\//i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/voice\/.*\.mp3$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'howlnight-voice',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
