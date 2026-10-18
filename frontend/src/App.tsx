import { useEffect, useState } from 'react'
import { ShoppingBag, X, Shirt, PersonStanding, Settings as SettingsIcon, Plus, Scan } from 'lucide-react'
import { ClothingGrid } from '@/components/ui/clothingGrid'
import { ClothingFilterBar } from '@/components/ui/filterBar'
import { Button } from '@/components/ui/button'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useWardrobe } from '@/hooks/useWardrobe'
import { useIsMobile } from '@/hooks/use-mobile'
import { initTheme } from '@/components/Settings'
import Shop from '@/components/Shop'
import TryOn from '@/components/TryOn'
import Settings from '@/components/Settings'
import { IconButton, QuietAction } from '@/components/kit/buttons'
import { FieldLabel } from '@/components/kit/fields'
import { Heading, ImageTile, TileCaption, CollageTile } from '@/components/kit/tiles'
import { CountBadge, EmptyState, Toast, useToast } from '@/components/kit/feedback'
import { SectionHeader, ScrollPanel } from '@/components/kit/layout'
import type { OutfitSlot, Clothing, Outfit } from '@/types'
import { cn } from '@/lib/utils'
import {
  NO_FILTERS, marketplaceOf, matchesQuery,
  type Filters,
} from '@/lib/filters'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// App.tsx — the app shell. Holds which tab is open, the cart drawer, and the
// wardrobe view (clothing library + outfit editor). The tabs themselves live
// in their own files: Shop, TryOn, Settings.

const SLOTS: OutfitSlot[] = ['top', 'bottom', 'hat', 'dress', 'jacket']

type Tab = 'shop' | 'wardrobe' | 'tryon' | 'settings'

const TABS: { id: Tab; label: string; icon: typeof ShoppingBag }[] = [
  { id: 'shop', label: 'Shop', icon: ShoppingBag },
  { id: 'wardrobe', label: 'Wardrobe', icon: Shirt },
  { id: 'tryon', label: 'Try-On', icon: PersonStanding },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

// Desktop nav rail: shadcn Sidebar, print-shop styling (uppercase, square).
function AppSidebar({ tab, onNavigate, cartCount, onOpenCart }: {
  tab: Tab
  onNavigate: (t: Tab) => void
  cartCount: number
  onOpenCart: () => void
}) {
  return (
    <Sidebar collapsible="none">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <span className="font-heading text-xl uppercase tracking-[0.14em]">Shiah's Closet</span>
        <FieldLabel className="mt-1 flex items-center gap-1.5">
          <Scan className="size-3" /> Personal lookbook
        </FieldLabel>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {TABS.map((t) => {
                const Icon = t.icon
                return (
                  <SidebarMenuItem key={t.id}>
                    <SidebarMenuButton
                      isActive={tab === t.id}
                      onClick={() => onNavigate(t.id)}
                      className="text-xs uppercase tracking-[0.14em]"
                    >
                      <Icon className="size-4" />
                      {t.label}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onOpenCart} className="text-xs uppercase tracking-[0.14em]">
              <ShoppingBag className="size-4" />
              Cart
              <CountBadge count={cartCount} />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <span className="px-3 pb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Window shopping, on file
        </span>
      </SidebarFooter>
    </Sidebar>
  )
}

// Mobile bottom tab bar (Sidebar is desktop-only).
function MobileNav({ tab, onNavigate }: { tab: Tab; onNavigate: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t bg-background/95 py-2 backdrop-blur">
      {TABS.map((t) => {
        const Icon = t.icon
        return (
          <button
            key={t.id}
            onClick={() => onNavigate(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 px-1 py-2 text-sm tracking-wide transition-colors',
              tab === t.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}

// Slot picker: click a slot tile in the outfit editor -> popover with the
// same search + filter bar as the clothing section, then a thumbnail grid.
function SlotPicker({
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

// Outfit grid tile: collage of mini images (one per assigned item) inside one
// larger container. Click opens the editor dialog.
function OutfitTile({
  outfit,
  clothing,
  onAssign,
  onRename,
  onDelete,
  open: openProp,
  onOpenChange,
}: {
  outfit: Outfit
  clothing: Clothing[]
  onAssign: (outfitId: number, slot: OutfitSlot, clothingId: number | null) => Promise<void>
  onRename: (id: number, name: string) => Promise<void>
  onDelete: (outfit: Outfit) => Promise<void>
  // Controlled open lets "New outfit" pop the editor immediately.
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [openSelf, setOpenSelf] = useState(false)
  const isOpen = openProp ?? openSelf
  const setOpen = (v: boolean) => {
    setOpenSelf(v)
    onOpenChange?.(v)
  }
  const items = SLOTS.map((s) => outfit[s]).filter(Boolean) as Clothing[]

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group flex flex-col gap-1 text-left">
        <CollageTile items={items.map((c) => ({ src: c.path, alt: c.name }))} emptyLabel="Empty outfit" />
        <TileCaption className="text-xs">{outfit.name || 'Untitled outfit'}</TileCaption>
      </button>

      <Dialog open={isOpen} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{outfit.name ? 'Edit outfit' : 'New outfit'}</DialogTitle>
          </DialogHeader>
          <Input
            value={outfit.name}
            placeholder="Outfit name"
            onChange={(e) => onRename(outfit.id, e.target.value)}
          />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {SLOTS.map((slot) => (
              <SlotPicker
                key={slot}
                slot={slot}
                clothing={clothing}
                assigned={outfit[slot]}
                onPick={(id) => onAssign(outfit.id, slot, id)}
                onClear={() => onAssign(outfit.id, slot, null)}
              />
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {/* ponytail: Share UI hidden for now — shareOutfit in lib/shareOutfit.ts stays */}
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(outfit)
                setOpen(false)
              }}
            >
              Delete outfit
            </Button>
            {/* Every change above already wrote to the DB — Save just closes. */}
            <Button onClick={() => setOpen(false)}>Save outfit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Cart drawer on the shared Sheet primitive (right side, max-w-md).
function CartSheet({
  cart,
  open,
  onOpenChange,
  onRemove,
}: {
  cart: Clothing[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onRemove: (id: number) => Promise<void>
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto bg-background p-6 sm:max-w-md" showCloseButton={false}>
        <SectionHeader
          title="Cart"
          level={2}
          className="mb-4"
          action={
            <Button variant="ghost" size="icon" aria-label="Close cart" onClick={() => onOpenChange(false)}>
              <X className="size-5" />
            </Button>
          }
        />
        {cart.length === 0 ? (
          <EmptyState message="Nothing here yet — tap the bag on any product in Shop to park it for later." />
        ) : (
          <ul className="flex flex-col gap-4">
            {cart.map((item) => (
              <li key={item.id} className="flex gap-3">
                <div className="size-16 shrink-0 overflow-hidden bg-muted/50">
                  {item.path && <img src={item.path} alt={item.name} className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.brand}
                    {item.price ? ` · $${item.price}` : ''}
                  </p>
                  <div className="mt-1 flex gap-2">
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                      >
                        Buy at {item.brand || 'store'}
                      </a>
                    )}
                    <QuietAction tone="destructive" onClick={() => onRemove(item.id)}>
                      Remove
                    </QuietAction>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  )
}

export default function App() {
  const wardrobe = useWardrobe()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<Tab>('shop')
  const [cartOpen, setCartOpen] = useState(false)
  const [creatingId, setCreatingId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [outfitQuery, setOutfitQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const { toast, show, dismiss } = useToast(5000)

  function onSavedFromShop(name: string) {
    show(`Saved to wardrobe — ${name}`, {
      label: 'View',
      run: () => setTab('wardrobe'),
    })
  }

  // Delete with a 5s undo: clothing is re-added with its original fields.
  async function deleteClothingWithUndo(item: Clothing) {
    await wardrobe.deleteClothing(item.id)
    show(`Deleted ${item.name}`, {
      label: 'Undo',
      run: () => {
        wardrobe
          .addClothing({ name: item.name, path: item.path, type: item.type, brand: item.brand, url: item.url, price: item.price })
          .catch(() => show("Couldn't undo"))
      },
    })
  }

  // Delete an outfit with undo: recreate it, restore name + slot assignments.
  async function deleteOutfitWithUndo(outfit: Outfit) {
    await wardrobe.deleteOutfit(outfit.id)
    show(`Deleted ${outfit.name || 'outfit'}`, {
      label: 'Undo',
      run: async () => {
        try {
          const id = await wardrobe.addOutfit()
          if (outfit.name) await wardrobe.renameOutfit(id, outfit.name)
          for (const slot of SLOTS) {
            const piece = outfit[slot]
            if (piece) await wardrobe.updateOutfitPiece(id, slot, piece.id)
          }
        } catch {
          show("Couldn't undo")
        }
      },
    })
  }

  // Filter-pill values: unique brand names / marketplace hostnames across the
  // whole wardrobe.
  const brands: string[] = []
  const markets: string[] = []
  for (const c of wardrobe.clothing) {
    if (c.brand && !brands.includes(c.brand)) brands.push(c.brand)
    const market = marketplaceOf(c)
    if (market && !markets.includes(market)) markets.push(market)
  }

  useEffect(() => initTheme(), [])

  if (wardrobe.status === 'loading') {
    return <div className="p-8 text-muted-foreground">Loading…</div>
  }

  if (wardrobe.status === 'error') {
    return (
      <div className="mx-auto max-w-md p-8">
        <Heading level={1} className="mb-2">
          {wardrobe.opfsUnavailable ? 'Browser not supported' : 'Something went wrong'}
        </Heading>
        <p className="text-sm text-muted-foreground">
          {wardrobe.opfsUnavailable
            ? "Shiah's Closet stores your wardrobe in your browser (OPFS), which this browser does not support. Try a recent version of Chrome, Edge, Firefox, or Safari."
            : wardrobe.error}
        </p>
      </div>
    )
  }

  // --- Wardrobe tab pieces (computed above the return, not inline in JSX) ---

  // The clothing list after search + filter pills are applied.
  const shownClothing = wardrobe.clothing.filter((c) => matchesQuery(c, query, filters))

  // The outfit list after the name search is applied.
  const outfitQ = outfitQuery.trim().toLowerCase()
  const shownOutfits = wardrobe.outfits.filter((o) => !outfitQ || o.name.toLowerCase().includes(outfitQ))

  return (
    <SidebarProvider className="h-dvh overflow-hidden">
      {/* Exactly one nav: JS-driven, so sidebar and bottom bar can never both show */}
      {!isMobile && (
        <AppSidebar tab={tab} onNavigate={setTab} cartCount={wardrobe.cart.length} onOpenCart={() => setCartOpen(true)} />
      )}
      <SidebarInset>
        {isMobile && (
          <header className="flex items-center justify-between pt-6 pb-4 max-md:px-4">
            <Heading level={2} className="font-medium">Shiah's Closet</Heading>
            <IconButton
              size="md"
              className="relative border border-border hover:bg-muted hover:text-foreground"
              onClick={() => setCartOpen(true)}
              aria-label="Open cart"
            >
              <ShoppingBag className="size-5" />
              <CountBadge count={wardrobe.cart.length} corner />
            </IconButton>
          </header>
        )}

        <main className="flex min-h-0 flex-1 flex-col">
          {tab === 'shop' && <Shop wardrobe={wardrobe} onSaved={onSavedFromShop} />}
          {tab === 'wardrobe' && (
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
                    action={{ label: 'Browse Shop', onClick: () => setTab('shop') }}
                  />
                ) : shownClothing.length === 0 ? (
                  <EmptyState message="No matches." className="p-4" />
                ) : (
                  <ClothingGrid value={shownClothing} onRemove={deleteClothingWithUndo} />
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
                        onDelete={deleteOutfitWithUndo}
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
          )}
          {tab === 'tryon' && (
            <div className="flex min-h-0 flex-1 flex-col p-4 pb-28 sm:p-6 max-md:pb-24">
              <TryOn wardrobe={wardrobe} />
            </div>
          )}
          {tab === 'settings' && (
            <ScrollPanel>
              <Settings wardrobe={wardrobe} />
            </ScrollPanel>
          )}
        </main>

        {isMobile && <MobileNav tab={tab} onNavigate={setTab} />}

        {toast && <Toast toast={toast} onAction={dismiss} />}

        <CartSheet
          cart={wardrobe.cart}
          open={cartOpen}
          onOpenChange={setCartOpen}
          onRemove={(id) => wardrobe.setInCart(id, false)}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
