// catalog.ts — site configs + image downloading. The Shop tab now browses the
// store directly through the proxy worker (Minibrowser.tsx); this module keeps
// SITE_CONFIGS (shared with the injected scraper) and toDataUrl, which inlines
// saved product images as data URLs so wardrobe items work offline.
import type { SiteConfig } from './scraper'

import brandyMelville from './configs/brandy-melville.json'
import subdued from './configs/subdued.json'

// The JSON files are plain data written by hand; this cast tells TypeScript
// they follow the SiteConfig shape the scraper expects.
export const SITE_CONFIGS = [brandyMelville, subdued] as unknown as SiteConfig[]

// ponytail: direct fetch first — store CDNs (Shopify) send ACAO:* so the
// browser can download cross-origin with zero proxy requests. Public proxies
// (allorigins, corsproxy) only catch hosts without CORS.
// ponytail: 6MB ceiling — bigger files stay as remote URLs (they break if the
// store rotates CDN paths; acceptable for a per-device app).
const MAX_IMAGE_BYTES = 6 * 1024 * 1024

// Download an image and turn it into a "data:..." URL so it can be stored
// directly in the database. Tries the URL directly first, then two public
// CORS proxies for hosts that block cross-origin downloads.
// Returns null when every attempt fails (caller keeps the remote URL instead).
export async function toDataUrl(imageUrl: string): Promise<string | null> {
  const attempts = [
    imageUrl,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(imageUrl)}`,
  ]
  for (const url of attempts) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const buf = await res.arrayBuffer()
      if (buf.byteLength > MAX_IMAGE_BYTES) continue
      const type = res.headers.get('content-type') ?? 'image/jpeg'
      const bytes = new Uint8Array(buf)
      // btoa() only accepts a text string, so the bytes are converted one
      // chunk at a time (String.fromCharCode has an argument count limit,
      // hence the 0x8000-sized slices).
      let binary = ''
      const chunk = 0x8000
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
      }
      return `data:${type};base64,${btoa(binary)}`
    } catch {
      continue // next attempt
    }
  }
  return null
}
