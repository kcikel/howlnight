/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/howlnight/',
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
        theme_color: '#0b0a12',
        background_color: '#0b0a12',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/howlnight/',
        lang: 'en',
        scope: '/howlnight/',
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/howlnight/index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
