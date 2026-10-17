import { useRef, useState } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OutfitImaginator } from '@/ai/api'
import { API_KEY_STORE } from '@/components/Settings'
import { toDataUrl } from '@/scraper/catalog'
import { NO_FILTERS, marketplaceOf, matchesQuery, type Filters } from '@/lib/filters'
import { ClothingFilterBar } from '@/components/ui/filterBar'
import type { Clothing, Outfit, OutfitSlot } from '@/types'
import type { useWardrobe } from '@/hooks/useWardrobe'
import { cn } from '@/lib/utils'
import { pillBase, pillActive, pillInactive, sectionHeading, cardCls, labelCls } from '@/lib/ui'

type Wardrobe = ReturnType<typeof useWardrobe>

const SLOT_ORDER: OutfitSlot[] = ['top', 'bottom', 'hat', 'dress', 'jacket']

// ponytail: single OpenRouter image model — flux-3-image-klein, called via
// the /api/v1/images endpoint (see ai/api.ts). If it degrades, change this
// constant (settings UI only when needed).
const MODEL = 'black-forest-labs/flux-3-image-klein'

// Items saved with the proxy fallback keep a remote URL as their path, and the
// image API won't follow redirects (301s) for remote refs — so every reference
// is resolved to a data URL right before the request.
async function resolvePath(p: string): Promise<string> {
  if (p.startsWith('data:')) return p
  const data = await toDataUrl(p)
  if (!data) {
    throw new Error(
      "Couldn't load an item's image — it was stored as a remote link and the download failed. Re-save the item in Shop, then try again.",
    )
  }
  return data
}

async function resolveItem(item: Clothing): Promise<Clothing> {
  return { ...item, path: await resolvePath(item.path) }
}

async function resolveOutfit(outfit: Outfit): Promise<Outfit> {
  const entries = await Promise.all(
    SLOT_ORDER.map(async (s) => [s, outfit[s] ? await resolveItem(outfit[s]!) : null] as const),
  )
  return { ...outfit, ...Object.fromEntries(entries) }
}

const tileCls = (selected: boolean) =>
  cn(
    'relative aspect-square overflow-hidden border bg-muted/40 transition-colors',
    selected
      ? 'border-foreground outline-2 -outline-offset-2 outline-foreground'
      : 'border-border/60 hover:border-foreground/40',
  )

// Try-On: pick one item or a whole outfit on the left, see the target photo
// giant on the right. The AI result replaces the target until kept or discarded.
export default function TryOn({ wardrobe }: { wardrobe: Wardrobe }) {
  const [photoId, setPhotoId] = useState<number | null>(null)
  const [mode, setMode] = useState<'item' | 'outfit'>('item')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [f, setF] = useState<Filters>(NO_FILTERS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const photo = wardrobe.photos.find((p) => p.id === photoId) ?? wardrobe.photos[0] ?? null
  const item = wardrobe.clothing.find((c) => c.id === selectedId) ?? null
  const outfit = wardrobe.outfits.find((o) => o.id === selectedId) ?? null
  const apiKey = localStorage.getItem(API_KEY_STORE) ?? ''

  // Items grouped in slot order, then by name — a clothing library, not a feed.
  const pool = [...wardrobe.clothing].sort(
    (a, b) => SLOT_ORDER.indexOf(a.type) - SLOT_ORDER.indexOf(b.type) || a.name.localeCompare(b.name),
  )
  const types = SLOT_ORDER.filter((t) => pool.some((c) => c.type === t))
  const brands = [...new Set(pool.map((c) => c.brand).filter(Boolean))]
  const markets = [...new Set(pool.map(marketplaceOf).filter(Boolean))]
  const shownItems = pool.filter((c) => matchesQuery(c, q, f))
  const shownOutfits = wardrobe.outfits.filter((o) => !q.trim() || o.name.toLowerCase().includes(q.trim().toLowerCase()))

  async function uploadPhoto(file: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    await wardrobe.addPhoto(dataUrl)
  }

  function pick(id: number) {
    setSelectedId((cur) => (cur === id ? null : id))
  }

  async function generate() {
    if (!photo || busy) return
    if (!apiKey) {
      setError('Add your OpenRouter API key in Settings first.')
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const imaginator = new OutfitImaginator(MODEL)
      imaginator.setApiKey(apiKey)
      imaginator.setTargetImage(photo.image)
      let image: string | null = null
      if (mode === 'item' && item) {
        image = await imaginator.requestClothingImage(await resolveItem(item))
      } else if (mode === 'outfit' && outfit) {
        image = await imaginator.requestImage(await resolveOutfit(outfit))
      }
      if (!image) {
        setError('Generation returned no image — try again.')
        return
      }
      setResult(image)
      await wardrobe.addTryon(
        image,
        mode === 'item' ? 'item' : 'outfit',
        selectedId!, // generate() only runs when a tile is selected
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed — try again.')
    } finally {
      setBusy(false)
    }
  }

  if (wardrobe.photos.length === 0) {
    return (
      <section className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4 border border-dashed border-border p-14 text-center">
          <p className="text-sm text-muted-foreground">
            Add a full-body photo to start trying things on. It stays on this device.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
          />
          <Button onClick={() => fileRef.current?.click()}>
            <Camera className="size-4" /> Add photo
          </Button>
        </div>
      </section>
    )
  }

  const searchPanel =
    mode === 'item' ? (
      // Same search + Filters popover as the Wardrobe's clothing library.
      <ClothingFilterBar
        query={q}
        onQuery={setQ}
        filters={f}
        onFilters={setF}
        types={types}
        brands={brands}
        markets={markets}
        showFilters={pool.length > 0}
      />
    ) : (
      <Input placeholder="Search outfits" value={q} onChange={(e) => setQ(e.target.value)} />
    )

  const itemTiles = shownItems.map((c) => (
    <button key={c.id} type="button" title={c.name} onClick={() => pick(c.id)} className="flex flex-col gap-1 text-left">
      <div className={tileCls(item?.id === c.id)}>
        {c.path && <img src={c.path} alt={c.name} className="h-full w-full object-cover" loading="lazy" />}
      </div>
      <p className="truncate text-[10px] text-muted-foreground">{c.name}</p>
    </button>
  ))

  const outfitTiles = shownOutfits.map((o) => {
    const pieces = SLOT_ORDER.map((s) => o[s]).filter(Boolean) as Clothing[]
    return (
      <button key={o.id} type="button" title={o.name || `Outfit #${o.id}`} onClick={() => pick(o.id)} className="flex flex-col gap-1 text-left">
        <div className={cn(tileCls(outfit?.id === o.id), 'grid grid-cols-2 gap-px')}>
          {pieces.length === 0 ? (
            <div className="col-span-2 flex items-center justify-center">
              <span className={labelCls}>Empty</span>
            </div>
          ) : (
            pieces.map((c, i) => (
              <div key={`${c.id}-${i}`} className={cn('aspect-square overflow-hidden bg-muted/40', pieces.length % 2 === 1 && i === 0 && 'col-span-2')}>
                <img src={c.path} alt={c.name} className="h-full w-full object-cover" loading="lazy" />
              </div>
            ))
          )}
        </div>
        <p className="truncate text-[10px] text-muted-foreground">{o.name || `Outfit #${o.id}`}</p>
      </button>
    )
  })

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
      {/* Picker: mode tabs, search, filters, tile grid, generate.
          Mobile shows the target photo first, so this sits after it (order). */}
      <aside className="order-2 flex min-h-0 w-full flex-col gap-3 lg:order-1 lg:w-96 lg:shrink-0">
        <h2 className={cn(sectionHeading, 'mb-1')}>Try-On</h2>
        <div className="flex gap-4">
          {(['item', 'outfit'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setSelectedId(null)
                setQ('')
                setF(NO_FILTERS)
              }}
              className={cn(pillBase, 'py-2 text-xs uppercase tracking-[0.14em]', mode === m ? pillActive : pillInactive)}
            >
              {m}
            </button>
          ))}
        </div>
        {searchPanel}
        <div className="grid min-h-0 flex-1 content-start grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2 overflow-y-auto pb-2 max-lg:max-h-[45dvh]">
          {mode === 'item'
            ? itemTiles.length === 0
              ? <p className="col-span-full p-2 text-sm text-muted-foreground">No matches.</p>
              : itemTiles
            : outfitTiles.length === 0
              ? <p className="col-span-full p-2 text-sm text-muted-foreground">No matches.</p>
              : outfitTiles}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          className="max-lg:w-full"
          disabled={!photo || busy || !selectedId}
          onClick={generate}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Generating…
            </>
          ) : (
            `Generate on ${mode}`
          )}
        </Button>
      </aside>

      {/* Target: photo switcher, giant image, result actions, history (first on mobile) */}
      <div className="order-1 flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto pt-2 lg:order-2 lg:pl-4">
        <div className="flex w-full flex-wrap items-center gap-2">
          <span className={labelCls}>Target photo</span>
          {wardrobe.photos.map((p) => (
            <button
              key={p.id}
              onClick={() => setPhotoId(p.id)}
              className={cn(
                'shrink-0 overflow-hidden border border-border outline-2 outline-offset-2 transition',
                p.id === (photo?.id ?? -1) ? 'outline-primary' : 'outline-transparent hover:outline-muted-foreground/40',
              )}
            >
              <img src={p.image} alt="Body photo" className="h-14 w-10 object-cover" />
            </button>
          ))}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-14 w-10 shrink-0 items-center justify-center border border-dashed border-border text-muted-foreground hover:bg-muted"
            aria-label="Add photo"
          >
            <Camera className="size-4" />
          </button>
        </div>

        <div className="relative flex w-full flex-1 items-start justify-center">
          {busy && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {result ? (
            <img src={result} alt="Try-on result" className="max-h-[70dvh] border border-border object-contain" />
          ) : (
            <img src={photo!.image} alt="Target body photo" className="max-h-[70dvh] border border-border object-contain" />
          )}
        </div>

        {result && (
          <div className={cn(cardCls, 'flex w-full max-w-md flex-col gap-2 p-4')}>
            <div className="flex justify-center gap-2">
              <Button
                onClick={async () => {
                  await wardrobe.addPhoto(result)
                  setResult(null)
                }}
              >
                Set as my photo
              </Button>
              <Button variant="outline" onClick={() => setResult(null)}>
                Discard
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Setting it as your photo layers the next outfit on this look.
            </p>
          </div>
        )}

        {wardrobe.tryons.length > 0 && (
          <div className="w-full">
            <h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">History</h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {wardrobe.tryons.map((t) => (
                <div key={t.id} className="group relative shrink-0">
                  <img src={t.image} alt="Past try-on" className="h-32 w-24 object-cover" />
                  <button
                    aria-label="Delete"
                    onClick={() => wardrobe.deleteTryon(t.id)}
                    className="absolute top-1 right-1 bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
