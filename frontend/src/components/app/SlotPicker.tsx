import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { ClothingFilterBar } from '@/components/ui/filterBar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { IconButton, QuietAction } from '@/components/kit/buttons'
import { FieldLabel } from '@/components/kit/fields'
import { ImageTile, TileCaption } from '@/components/kit/tiles'
import { EmptyState } from '@/components/kit/feedback'
import { NO_FILTERS, marketplaceOf, matchesQuery, type Filters } from '@/lib/filters'
import type { OutfitSlot, Clothing } from '@/types'

// SlotPicker.tsx — click a slot tile in the outfit editor -> popover with the
// same search + filter bar as the clothing section, then a thumbnail grid.

export default function SlotPicker({
  slot,
  clothing,
  assigned,
  onPick,
  onClear,
}: {
  slot: OutfitSlot
  clothing: Clothing[]
  assigned: Clothing | null
  onPick: (id: number) => void
  onClear: () => void
}) {
  const [q, setQ] = useState('')
  const [f, setF] = useState<Filters>(NO_FILTERS)
  const [open, setOpen] = useState(false)
  const pool = clothing.filter((c) => c.type === slot)

  // Filter-pill values: unique brand names / marketplace hostnames of the
  // items that could fill this slot.
  const brands: string[] = []
  const markets: string[] = []
  for (const c of pool) {
    if (c.brand && !brands.includes(c.brand)) brands.push(c.brand)
    const market = marketplaceOf(c)
    if (market && !markets.includes(market)) markets.push(market)
  }

  const shown = pool.filter((c) => matchesQuery(c, q, f))

  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{slot}</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              title={`Choose ${slot}`}
              className="relative flex aspect-square items-center justify-center overflow-hidden border border-border/60 bg-muted/40 transition-colors hover:border-foreground/40"
            >
              {assigned?.path ? (
                <img src={assigned.path} alt={assigned.name} className="h-full w-full object-cover" />
              ) : (
                <Plus className="size-4 text-muted-foreground" />
              )}
            </button>
          }
        />
        <PopoverContent className="w-[min(92vw,560px)] p-4" align="start">
          {/* Same search + Filters combo as the clothing library; the slot
              already fixes the type, so the Type group is omitted. */}
          <div className="flex items-center gap-2">
            <ClothingFilterBar
              query={q}
              onQuery={setQ}
              filters={f}
              onFilters={setF}
              types={[]}
              brands={brands}
              markets={markets}
            />
            <IconButton aria-label="Close" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </IconButton>
          </div>
          {shown.length === 0 ? (
            <EmptyState className="p-2" message={pool.length === 0 ? `No ${slot}s in your wardrobe yet.` : 'No matches.'} />
          ) : (
            <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
              {shown.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onPick(c.id)
                    setQ('')
                    setF(NO_FILTERS)
                  }}
                  className="flex flex-col gap-1 text-left"
                >
                  <ImageTile selected={assigned?.id === c.id}>
                    {c.path && <img src={c.path} alt={c.name} className="h-full w-full object-cover" loading="lazy" />}
                  </ImageTile>
                  <TileCaption>{c.name}</TileCaption>
                </button>
              ))}
            </div>
          )}
          {assigned && (
            <QuietAction
              tone="destructive"
              className="mt-3 block border-t border-border pt-2 text-left"
              onClick={() => {
                onClear()
                setQ('')
                setF(NO_FILTERS)
              }}
            >
              Remove current {slot}
            </QuietAction>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
