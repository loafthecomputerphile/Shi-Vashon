import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { onScrapedProduct, type ScrapedProduct } from '@/scraper/scraper'
import { saveProduct, type SaveResult } from '@/scraper/save'
import type { SiteConfig } from '@/scraper/scraper'
import type { Wardrobe } from '@/hooks/useWardrobe'
import { IconButton } from '@/components/kit/buttons'
import { StatusChip, Toast, useToast } from '@/components/kit/feedback'

// Worker proxy origin. Dev default '' keeps the iframe on the Vite dev
// server, whose /p rule forwards to wrangler (vite.config.js → server.proxy).
// Production sets VITE_PROXY_URL=https://<worker>.workers.dev in .env.
// Normalize: a bare host (no protocol) would become a relative iframe src —
// assume https:// unless an explicit scheme is given.
const rawProxyUrl = (import.meta.env.VITE_PROXY_URL as string | undefined) ?? ''
const PROXY_URL = rawProxyUrl && !rawProxyUrl.startsWith('http') ? `https://${rawProxyUrl}` : rawProxyUrl

// The minibrowser: iframes the store through the proxy worker. The injected
// scraper highlights config-targeted product images; clicking one postMessages
// the product here and we persist it via the shared save flow. Rendered
// full-screen overlay when onClose is given, embedded otherwise.
export default function Minibrowser({
  config,
  wardrobe,
  onClose,
  onSaved,
}: {
  config: SiteConfig
  wardrobe: Wardrobe
  onClose?: () => void
  onSaved?: (name: string) => void
}) {
  const { toast, show } = useToast(2500)
  const [scraperStatus, setScraperStatus] = useState<
    { page: string; productPage: boolean; noConfig?: boolean } | null
  >(null)
  // Start on the store's home page; the iframe navigates internally after that.
  const [startUrl] = useState(`https://${config.matchHosts[0]}`)
  // If the injected scraper never reports in, the page escaped the proxy.
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 4000)
    return () => clearTimeout(t)
  }, [])

  // A product click arrived from the injected scraper — save it and tell the
  // iframe the save went through (that's what flashes the image blue).
  // ponytail: hoisted to a named function so the message listener below stays
  // a thin wrapper; also means the save logic is easy to read on its own.
  async function handleProduct(product: ScrapedProduct, reply: (msg: object) => void) {
    if (!product.type) {
      show("Couldn't identify the item type — skipped.")
      return
    }
    const result: SaveResult = await saveProduct(product, {
      clothing: wardrobe.clothing,
      addClothing: wardrobe.addClothing,
      setInCart: wardrobe.setInCart,
      brand: config.brand,
    })
    // Success feedback is the app-level toast (with a View action) — a
    // second toast here would sit exactly on top of it. This one covers
    // the non-save outcomes.
    if (result === 'exists') {
      show('Already in wardrobe')
    } else {
      onSaved?.(product.name ?? 'item')
    }
    reply({ source: 'scrape-saved', image: product.image })
  }

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data as {
        source?: string
        page?: string
        productPage?: boolean
        noConfig?: boolean
        image?: string
      }
      if (d?.source === 'scraper-status') {
        setScraperStatus({ page: d.page ?? '', productPage: !!d.productPage, noConfig: d.noConfig })
        return
      }
      // Only trust save requests from the proxy origin.
      if (PROXY_URL.startsWith('http') && e.origin !== new URL(PROXY_URL).origin) return
      onScrapedProduct(e, async (product: ScrapedProduct) => {
        await handleProduct(product, (msg) => e.source?.postMessage(msg, { targetOrigin: '*' }))
      })
    }
    addEventListener('message', onMessage)
    return () => removeEventListener('message', onMessage)
  }, [wardrobe, config, onSaved, show])

  const frame = (
    <iframe
      src={`${PROXY_URL}/p?u=${encodeURIComponent(startUrl)}`}
      title={`Browse ${config.brand}`}
      className="h-full w-full flex-1 border-0"
    />
  )

  // The status chip under the iframe. Previously a 4-level ternary — written
  // out as if/else here so the order of checks is easy to follow.
  let chipText: string | null = null
  if (scraperStatus === null) {
    if (timedOut) {
      chipText = 'Scraper not detected — the page may have left the proxy'
    }
  } else if (scraperStatus.noConfig) {
    chipText = 'No scraper config for this site'
  } else if (scraperStatus.productPage) {
    chipText = 'Scraper live · product page — tap + Save on an image'
  } else {
    chipText = 'Scraper live · not a product page — open a product to save'
  }

  const chip = chipText && <StatusChip>{chipText}</StatusChip>

  if (!onClose) {
    // Embedded mode (Shop tab): fills the parent's remaining height.
    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden border border-border">
        {frame}
        {chip}
        {toast && <Toast toast={toast} variant="dark" />}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <IconButton size="sm" tone="fill" onClick={onClose} aria-label="Close browser">
          <ArrowLeft className="size-5" />
        </IconButton>
        <span className="truncate text-sm text-muted-foreground">{config.matchHosts[0]}</span>
      </header>
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {frame}
        {chip}
      </div>
      {toast && <Toast toast={toast} variant="dark" />}
    </div>
  )
}
