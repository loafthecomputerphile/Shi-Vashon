import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: "Shiah's Closet",
        short_name: "Shiah's Closet",
        description: 'Wardrobe, shopping and AI try-on',
        theme_color: '#f4eee0',
        background_color: '#f4eee0',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm}'] },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    // Dev only: forward the worker proxy path to wrangler dev so the
    // minibrowser iframe (which loads /p?u=…) hits the real worker.
    // ponytail: single '/p' rule — a '/proxy' alias would shadow-match
    // '/proxy/p…' by prefix and forward unrewritten, 404ing at the worker.
    proxy: {
      '/p': { target: 'http://127.0.0.1:8787' },
    },
  },
  worker: { format: 'es' },
})
