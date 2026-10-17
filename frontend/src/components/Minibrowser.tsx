import { useEffect, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { onScrapedProduct, type ScrapedProduct } from '@/scraper/scraper'
import { saveProduct, type SaveResult } from '@/scraper/save'
import type { SiteConfig } from '@/scraper/scraper'
import type { useWardrobe } from '@/hooks/useWardrobe'

type Wardrobe = ReturnType<typeof useWardrobe>

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
}: {
  config: SiteConfig
  wardrobe: Wardrobe
  onClose?: () => void
}) {
  const [msg, setMsg] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
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
        if (!product.type) {
          setMsg("Couldn't identify the item type — skipped.")
          setSaved(false)
          setTimeout(() => setMsg(null), 2500)
          return
        }
        const result: SaveResult = await saveProduct(product, {
          ...wardrobe,
          brand: config.brand,
        })
        setMsg(result === 'exists' ? 'Already in wardrobe' : `Saved — ${product.name}`)
        setSaved(result !== 'exists')
        e.source?.postMessage({ source: 'scrape-saved', image: product.image }, { targetOrigin: '*' })
        setTimeout(() => setMsg(null), 2500)
      })
    }
    addEventListener('message', onMessage)
    return () => removeEventListener('message', onMessage)
  }, [wardrobe, config])

  const frame = (
    <iframe
      src={`${PROXY_URL}/p?u=${encodeURIComponent(startUrl)}`}
      title={`Browse ${config.brand}`}
      className="h-full w-full flex-1 border-0"
    />
  )

  const chip = (
    <ScraperChip status={scraperStatus} timedOut={timedOut} />
  )

  if (!onClose) {
    // Embedded mode (Shop tab): fills the parent's remaining height.
      return (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden border border-border">
          {frame}
          {chip}
          {msg && <Toast msg={msg} saved={saved} />}
        </div>
      )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={onClose} className="p-1.5 hover:bg-muted" aria-label="Close browser">
          <ArrowLeft className="size-5" />
        </button>
        <span className="truncate text-sm text-muted-foreground">{config.matchHosts[0]}</span>
      </header>
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {frame}
        {chip}
      </div>
      {msg && <Toast msg={msg} saved={saved} />}
    </div>
  )
}

// Tiny status pill over the frame: confirms the injected scraper is alive and
// explains why nothing is highlighted when it isn't.
function ScraperChip({
  status,
  timedOut,
}: {
  status: { page: string; productPage: boolean; noConfig?: boolean } | null
  timedOut: boolean
}) {
  const text = !status
    ? timedOut
      ? 'Scraper not detected — the page may have left the proxy'
      : null
    : status.noConfig
      ? 'No scraper config for this site'
      : status.productPage
        ? 'Scraper live · product page — tap + Save on an image'
        : 'Scraper live · not a product page — open a product to save'
  if (!text) return null
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 bg-foreground/85 px-3 py-1.5 text-[11px] tracking-wide text-background shadow">
      {text}
    </div>
  )
}

function Toast({ msg, saved }: { msg: string; saved?: boolean }) {
  return (
    <div className="fixed bottom-24 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 bg-foreground px-5 py-2.5 text-xs tracking-wide text-background shadow-lg md:bottom-8">
      {saved && <Check className="size-3.5 text-[#00c853]" aria-hidden />}
      {msg}
    </div>
  )
}
