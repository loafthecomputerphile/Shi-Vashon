import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Builds the scraper + site configs into a single IIFE for the Cloudflare
// worker to inline into proxied store pages. Output deliberately lands in
// worker/src/scraper.inject.txt so wrangler's Text rule picks it up.
export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/scraper/inject-entry.ts'),
      name: 'ShiScraper',
      formats: ['iife'],
      fileName: () => 'scraper.inject.txt',
    },
    outDir: '../worker/src',
    emptyOutDir: false,
    minify: false, // ponytail: bundle is a few KB; esbuild dep not worth it
  },
})
