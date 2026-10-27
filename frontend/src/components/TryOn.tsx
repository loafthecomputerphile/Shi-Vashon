import { useEffect, useState } from 'react'
import { Camera, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OutfitImaginator } from '@/ai/api'
import { loadSession, type Session } from '@/lib/auth'
import { toDataUrl } from '@/scraper/catalog'
import { NO_FILTERS, marketplaceOf, matchesQuery, type Filters } from '@/lib/filters'
import { fileToDataUrl } from '@/lib/file'
import { ClothingFilterBar } from '@/components/ui/filterBar'
import { LoadingButton } from '@/components/kit/buttons'
import { UnderlineTabs, pillBase } from '@/components/kit/tabs'
import { FilePickButton, FieldLabel } from '@/components/kit/fields'
import { ImageTile, TileCaption, CollageTile, DeletableImageThumb, Heading } from '@/components/kit/tiles'
import { EmptyState, SpinnerOverlay } from '@/components/kit/feedback'
import type { Clothing, Outfit, OutfitSlot } from '@/types'
import type { Wardrobe } from '@/hooks/useWardrobe'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

// TryOn.tsx — the virtual try-on screen. Pick one clothing item or a whole
// outfit on the left, see the target photo (your body photo) giant on the
// right, and press "Generate" to have the AI dress the person in the photo.
// The AI result replaces the target photo on screen until kept or discarded.

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
  // ponytail: resolve each slot one at a time instead of Promise.all +
  // Object.fromEntries — same result, easier to read.
  const resolved: Outfit = { ...outfit }
  for (const slot of SLOT_ORDER) {
    const item = outfit[slot]
    resolved[slot] = item ? await resolveItem(item) : null
  }
  return resolved
}

export default function TryOn({ wardrobe }: { wardrobe: Wardrobe }) {
  const [photoId, setPhotoId] = useState<number | null>(null)
  const [mode, setMode] = useState<'item' | 'outfit'>('item')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [f, setF] = useState<Filters>(NO_FILTERS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const isMobile = useIsMobile()

  // Quota display comes from /api/me (limit is null for the owner — hidden).
  useEffect(() => { loadSession().then(setSession) }, [])

  const photo = wardrobe.photos.find((p) => p.id === photoId) ?? wardrobe.photos[0] ?? null
  const item = wardrobe.clothing.find((c) => c.id === selectedId) ?? null
  const outfit = wardrobe.outfits.find((o) => o.id === selectedId) ?? null

  // Items sorted so the library groups by slot (tops together, bottoms…),
  // then alphabetically by name inside each slot.
  const pool = [...wardrobe.clothing].sort((a, b) => {
    const slotDiff = SLOT_ORDER.indexOf(a.type) - SLOT_ORDER.indexOf(b.type)
    if (slotDiff !== 0) return slotDiff
    return a.name.localeCompare(b.name)
  })

  const types = SLOT_ORDER.filter((t) => pool.some((c) => c.type === t))

  // Filter-pill values: unique brand names / marketplace hostnames.
  const brands: string[] = []
  const markets: string[] = []
  for (const c of pool) {
    if (c.brand && !brands.includes(c.brand)) brands.push(c.brand)
    const market = marketplaceOf(c)
    if (market && !markets.includes(market)) markets.push(market)
  }

  const shownItems = pool.filter((c) => matchesQuery(c, q, f))
  const trimmedQ = q.trim().toLowerCase()
  const shownOutfits = wardrobe.outfits.filter((o) => !trimmedQ || o.name.toLowerCase().includes(trimmedQ))

  async function uploadPhoto(file: File) {
    await wardrobe.addPhoto(await fileToDataUrl(file))
  }

  function pick(id: number) {
    // Clicking the already-selected tile deselects it.
    if (selectedId === id) {
      setSelectedId(null)
    } else {
      setSelectedId(id)
    }
    // On a phone the picker folds away after a pick so the person fills the screen.
    if (isMobile) setPickerOpen(false)
  }

  async function generate() {
    if (!photo || busy) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const imaginator = new OutfitImaginator(MODEL)
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
      await wardrobe.addTryon(image, mode, selectedId!) // generate() only runs when a tile is selected
      // Refresh the daily counter after a successful generation.
      loadSession().then(setSession)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed — try again.')
      loadSession().then(setSession) // a spent slot updates the counter too
    } finally {
      setBusy(false)
    }
  }

  if (wardrobe.photos.length === 0) {
    return (
      <section className="flex flex-1 items-center justify-center">
        <EmptyState
          variant="hero"
          message="Add a full-body photo to start trying things on. It stays on this device."
        >
          <FilePickButton
            onFile={uploadPhoto}
            trigger={
              <Button>
                <Camera className="size-4" /> Add photo
              </Button>
            }
          />
        </EmptyState>
      </section>
    )
  }

  // Search bar: items get the full filter bar, outfits just a name search.
  let searchPanel: React.ReactNode
  if (mode === 'item') {
    // Same search + Filters popover as the Wardrobe's clothing library.
    searchPanel = (
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
    )
  } else {
    searchPanel = <Input placeholder="Search outfits" value={q} onChange={(e) => setQ(e.target.value)} />
  }

  // The tile grid: clothing buttons or outfit collage buttons.
  let tiles: React.ReactNode
  if (mode === 'item') {
    tiles =
      shownItems.length === 0 ? (
        <EmptyState message="No matches." className="col-span-full p-2" />
      ) : (
        shownItems.map((c) => (
          <button key={c.id} type="button" title={c.name} onClick={() => pick(c.id)} className="flex flex-col gap-1 text-left">
            <ImageTile selected={item?.id === c.id}>
              {c.path && <img src={c.path} alt={c.name} className="h-full w-full object-cover" loading="lazy" />}
            </ImageTile>
            <TileCaption>{c.name}</TileCaption>
          </button>
        ))
      )
  } else {
    tiles =
      shownOutfits.length === 0 ? (
        <EmptyState message="No matches." className="col-span-full p-2" />
      ) : (
        shownOutfits.map((o) => {
          const pieces = SLOT_ORDER.map((s) => o[s]).filter(Boolean) as Clothing[]
          return (
            <button key={o.id} type="button" title={o.name || `Outfit #${o.id}`} onClick={() => pick(o.id)} className="flex flex-col gap-1 text-left">
              <CollageTile
                items={pieces.map((c) => ({ src: c.path, alt: c.name }))}
                emptyLabel="Empty"
                className={cn(
                  outfit?.id === o.id && 'border-foreground outline-2 -outline-offset-2 outline-foreground',
                  outfit?.id !== o.id && 'hover:border-foreground/40',
                )}
              />
              <TileCaption>{o.name || `Outfit #${o.id}`}</TileCaption>
            </button>
          )
        })
      )
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
      {/* Picker: mode tabs, search, filters, tile grid, generate.
          Mobile shows the target photo first, so this sits after it (order). */}
      <aside className="order-2 flex min-h-0 w-full flex-col gap-3 lg:order-1 lg:w-96 lg:shrink-0">
        <div className="flex items-center justify-between">
          <Heading level={3} className="mb-1">Try-On</Heading>
          <button
            type="button"
            onClick={() => setPickerOpen(!pickerOpen)}
            aria-expanded={pickerOpen}
            className={cn(pillBase, 'py-1 max-lg:inline-flex max-lg:items-center max-lg:gap-1 lg:hidden')}
          >
            <span className="text-xs uppercase tracking-[0.14em]">{pickerOpen ? 'Hide' : 'Show'}</span>
            <ChevronDown className={cn('size-3.5 transition-transform', pickerOpen && 'rotate-180')} />
          </button>
        </div>
        {/* Accordion body: tabs + search + grid. Hidden (mobile) when folded —
            a mini view of the selection shows instead. Desktop always open. */}
        <div className={cn('min-h-0 flex-1 flex-col gap-3', pickerOpen ? 'flex' : 'max-lg:hidden lg:flex')}>
          <UnderlineTabs
            items={[
              { id: 'item', label: 'clothing' },
              { id: 'outfit', label: 'outfits' },
            ]}
            activeId={mode}
            onChange={(m) => {
              // The tab ids are exactly our two modes; pick the matching one.
              setMode(m === 'outfit' ? 'outfit' : 'item')
              setSelectedId(null)
              setQ('')
              setF(NO_FILTERS)
            }}
          />
          {searchPanel}
          <div className="grid min-h-0 flex-1 content-start grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2 overflow-y-auto pb-2 max-lg:max-h-[45dvh]">
            {tiles}
          </div>
        </div>
        {!pickerOpen && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-3 border border-border/60 bg-muted/40 p-2 text-left"
          >
            {item || outfit ? (
              <>
                {mode === 'item' && item && (
                  <img src={item.path} alt={item.name} className="size-12 border border-border/60 object-cover" />
                )}
                {mode === 'outfit' && outfit && (
                  <span className="grid size-12 grid-cols-2 gap-px overflow-hidden border border-border/60">
                    {(SLOT_ORDER.map((s) => outfit[s]).filter(Boolean) as Clothing[]).map((c, i) => (
                      <img key={`${c.id}-${i}`} src={c.path} alt={c.name} className="h-full w-full object-cover" />
                    ))}
                  </span>
                )}
                <span className="truncate text-xs text-muted-foreground">
                  {mode === 'item' ? item?.name : outfit?.name || `Outfit #${outfit?.id}`}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Tap to pick a {mode}</span>
            )}
          </button>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {session?.limit != null && (
          <p className="text-xs text-muted-foreground">
            {Math.max(0, session.limit - (session.used ?? 0))} of {session.limit} generations left today
          </p>
        )}
        <LoadingButton
          className="max-lg:w-full"
          busy={busy}
          busyLabel="Generating…"
          disabled={!photo || !selectedId}
          onClick={generate}
        >
          Generate on {mode === 'item' ? 'clothing' : 'outfits'}
        </LoadingButton>
      </aside>

      {/* Target: photo switcher, giant image, result actions, history (first on mobile) */}
      <div className="order-1 flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto pt-2 lg:order-2 lg:pl-4">
        <div className="flex w-full flex-wrap items-center gap-2">
          <FieldLabel>Target photo</FieldLabel>
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
          <FilePickButton
            onFile={uploadPhoto}
            trigger={
              <button
                className="flex h-14 w-10 shrink-0 items-center justify-center border border-dashed border-border text-muted-foreground hover:bg-muted"
                aria-label="Add photo"
              >
                <Camera className="size-4" />
              </button>
            }
          />
        </div>

        <div className="relative flex w-full flex-1 items-start justify-center">
          {busy && <SpinnerOverlay />}
          {result ? (
            <img src={result} alt="Try-on result" className="max-h-[70dvh] border border-border object-contain" />
          ) : (
            <img src={photo!.image} alt="Target body photo" className="max-h-[70dvh] border border-border object-contain" />
          )}
        </div>

        {result && (
          <div className="flex w-full max-w-md flex-col gap-2 border border-border bg-card p-4">
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
            <FieldLabel as="h3" className="mb-2">History</FieldLabel>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {wardrobe.tryons.map((t) => (
                <DeletableImageThumb
                  key={t.id}
                  src={t.image}
                  alt="Past try-on"
                  className="h-32 w-24"
                  onDelete={() => wardrobe.deleteTryon(t.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
