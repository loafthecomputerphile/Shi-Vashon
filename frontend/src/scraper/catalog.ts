// catalog.ts — site configs + image downloading. The Shop tab now browses the
// store directly through the proxy worker (Minibrowser.tsx); this module keeps
// SITE_CONFIGS (shared with the injected scraper) and toDataUrl, which inlines
// saved product images as data URLs so wardrobe items work offline.
import type { SiteConfig } from './scraper'

import brandyMelville from './configs/brandy-melville.json'
import subdued from './configs/subdued.json'

export const SITE_CONFIGS = [brandyMelville, subdued] as unknown as SiteConfig[]

// ponytail: direct fetch first — store CDNs (Shopify) send ACAO:* so the
// browser can download cross-origin with zero proxy requests. Public proxies
// (allorigins, corsproxy) only catch hosts without CORS.
// ponytail: 6MB ceiling — bigger files stay as remote URLs (they break if the
// store rotates CDN paths; acceptable for a per-device app).
const MAX_IMAGE_BYTES = 6 * 1024 * 1024

export async function toDataUrl(imageUrl: string): Promise<string | null> {
  for (const proxy of [
    (u: string) => u,
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  ]) {
    try {
      const res = await fetch(proxy(imageUrl))
      if (!res.ok) continue
      const buf = await res.arrayBuffer()
      if (buf.byteLength > MAX_IMAGE_BYTES) continue
      const type = res.headers.get('content-type') ?? 'image/jpeg'
      const bytes = new Uint8Array(buf)
      let binary = ''
      const chunk = 0x8000
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
      }
      return `data:${type};base64,${btoa(binary)}`
    } catch {
      continue // next proxy; on total failure caller keeps the remote URL
    }
  }
  return null
}
