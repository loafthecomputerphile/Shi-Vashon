import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ClothingGrid } from '@/components/ui/clothingGrid'
import { ClothingFilterBar } from '@/components/ui/filterBar'
import { Heading } from '@/components/kit/tiles'
import { EmptyState } from '@/components/kit/feedback'
import { SectionHeader, ScrollPanel } from '@/components/kit/layout'
import { SLOTS } from '@/components/app/nav-shared'
import OutfitTile from '@/components/app/OutfitTile'
import { marketplaceOf, matchesQuery, type Filters } from '@/lib/filters'
import type { Clothing, Outfit } from '@/types'
import type { useWardrobe } from '@/hooks/useWardrobe'

// WardrobeView.tsx — the Wardrobe tab: clothing library (search + filter
// pills + grid) and the outfits section (search + tiles that open editors).

export default function WardrobeView({
  wardrobe,
  query,
  setQuery,
  filters,
  setFilters,
  outfitQuery,
  setOutfitQuery,
  creatingId,
  setCreatingId,
  onDeleteClothing,
  onDeleteOutfit,
  onBrowseShop,
}: {
  wardrobe: ReturnType<typeof useWardrobe>
  query: string
  setQuery: (q: string) => void
  filters: Filters
  setFilters: (f: Filters) => void
  outfitQuery: string
  setOutfitQuery: (q: string) => void
  creatingId: number | null
  setCreatingId: (id: number | null) => void
  onDeleteClothing: (item: Clothing) => Promise<void>
  onDeleteOutfit: (outfit: Outfit) => Promise<void>
  onBrowseShop: () => void
}) {
  // Filter-pill values: unique brand names / marketplace hostnames across the
  // whole wardrobe.
  const brands: string[] = []
  const markets: string[] = []
  for (const c of wardrobe.clothing) {
    if (c.brand && !brands.includes(c.brand)) brands.push(c.brand)
    const market = marketplaceOf(c)
    if (market && !markets.includes(market)) markets.push(market)
  }

  // The clothing list after search + filter pills are applied.
  const shownClothing = wardrobe.clothing.filter((c) => matchesQuery(c, query, filters))

  // The outfit list after the name search is applied.
  const outfitQ = outfitQuery.trim().toLowerCase()
  const shownOutfits = wardrobe.outfits.filter((o) => !outfitQ || o.name.toLowerCase().includes(outfitQ))

  return (
    <ScrollPanel>
      <section className="mb-14">
        <Heading level={3} className="mb-4">Clothing library</Heading>
        <div className="mb-4">
          <ClothingFilterBar
            query={query}
            onQuery={setQuery}
            filters={filters}
            onFilters={setFilters}
            types={SLOTS}
            brands={brands}
            markets={markets}
            showFilters={wardrobe.clothing.length > 0}
          />
        </div>
        {wardrobe.clothing.length === 0 ? (
          <EmptyState
            variant="action"
            message="Nothing here yet — save an item while browsing a store."
            action={{ label: 'Browse Shop', onClick: onBrowseShop }}
          />
        ) : shownClothing.length === 0 ? (
          <EmptyState message="No matches." className="p-4" />
        ) : (
          <ClothingGrid value={shownClothing} onRemove={onDeleteClothing} />
        )}
      </section>

      <section>
        <SectionHeader
          title="Outfits"
          className="mb-3"
          action={
            <Button
              onClick={async () => {
                const id = await wardrobe.addOutfit()
                setOutfitQuery('') // a filtered-out tile can't auto-open its editor
                setCreatingId(id) // pop the editor immediately; Save closes it
              }}
            >
              New outfit
            </Button>
          }
        />
        <Input
          placeholder="Search outfits"
          value={outfitQuery}
          onChange={(e) => setOutfitQuery(e.target.value)}
          className="mb-4"
        />
        {wardrobe.outfits.length === 0 ? (
          <EmptyState message="No outfits yet — create one above." />
        ) : shownOutfits.length === 0 ? (
          <EmptyState message="No matching outfits." />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {shownOutfits.map((outfit) => (
              <OutfitTile
                key={outfit.id}
                outfit={outfit}
                clothing={wardrobe.clothing}
                onAssign={wardrobe.updateOutfitPiece}
                onRename={wardrobe.renameOutfit}
                onDelete={onDeleteOutfit}
                open={creatingId === outfit.id || undefined}
                onOpenChange={(o) => {
                  if (!o) setCreatingId(null)
                }}
              />
            ))}
          </div>
        )}
      </section>
    </ScrollPanel>
  )
}
