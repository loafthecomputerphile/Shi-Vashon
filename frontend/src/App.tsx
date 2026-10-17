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
import { useWardrobe } from '@/hooks/useWardrobe'
import { useIsMobile } from '@/hooks/use-mobile'
import { initTheme } from '@/components/Settings'
import Shop from '@/components/Shop'
import TryOn from '@/components/TryOn'
import Settings from '@/components/Settings'
import type { OutfitSlot, Clothing, Outfit } from '@/types'
import { cn } from '@/lib/utils'
import { sectionHeading, labelCls, pillBase, pillActive, pillInactive } from '@/lib/ui'
import {
  FilterPillRow, NO_FILTERS, marketplaceOf, matchesQuery, toggleIn,
  type Filters,
} from '@/lib/filters'
import { Input } from '@/components/ui/input'
import { shareOutfit } from '@/lib/shareOutfit'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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
        <span className={cn(labelCls, 'mt-1 flex items-center gap-1.5')}>
          <Scan className="size-3" /> Personal lookbook
        </span>
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
              {cartCount > 0 && (
                <span className="ml-auto bg-primary px-1.5 text-[10px] font-medium tabular-nums text-primary-foreground">
                  {cartCount}
                </span>
              )}
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
  const pool = clothing.filter((c) => c.type === slot)
  const brands = [...new Set(pool.map((c) => c.brand).filter(Boolean))]
  const markets = [...new Set(pool.map(marketplaceOf).filter(Boolean))]
  const shown = pool.filter((c) => matchesQuery(c, q, f))

  return (
    <div className="flex flex-col gap-1">
      <span className={labelCls}>{slot}</span>
      <Popover>
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
          <Input
            placeholder="Search by name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mb-3"
          />
          <div className="mb-3 flex flex-col gap-2">
            <FilterPillRow label="Type" values={[slot]} selected={new Set([slot])} onToggle={() => {}} />
            <FilterPillRow
              label="Brand"
              values={brands}
              selected={f.brands}
              onToggle={(v) => setF({ ...f, brands: toggleIn(f.brands, v) })}
            />
            <FilterPillRow
              label="Marketplace"
              values={markets}
              selected={f.markets}
              onToggle={(v) => setF({ ...f, markets: toggleIn(f.markets, v) })}
            />
          </div>
          {shown.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">
              {pool.length === 0 ? `No ${slot}s in your wardrobe yet.` : 'No matches.'}
            </p>
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
                  <div
                    className={cn(
                      'aspect-square overflow-hidden border bg-muted/40',
                      assigned?.id === c.id ? 'border-foreground' : 'border-border/60',
                    )}
                  >
                    {c.path && <img src={c.path} alt={c.name} className="h-full w-full object-cover" loading="lazy" />}
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">{c.name}</p>
                </button>
              ))}
            </div>
          )}
          {assigned && (
            <button
              type="button"
              onClick={() => {
                onClear()
                setQ('')
                setF(NO_FILTERS)
              }}
              className="mt-3 border-t border-border pt-2 text-left text-xs text-muted-foreground transition-colors hover:text-destructive"
            >
              Remove current {slot}
            </button>
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
}: {
  outfit: Outfit
  clothing: Clothing[]
  onAssign: (outfitId: number, slot: OutfitSlot, clothingId: number | null) => Promise<void>
  onRename: (id: number, name: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [shareNote, setShareNote] = useState<string | null>(null)
  const items = SLOTS.map((s) => outfit[s]).filter(Boolean) as Clothing[]

  async function onShare() {
    const r = await shareOutfit(outfit)
    setShareNote(
      r === 'shared' ? 'Shared ✓' : r === 'downloaded' ? 'Image saved ✓' : r === 'none' ? 'Outfit is empty' : "Couldn't share",
    )
    setTimeout(() => setShareNote(null), 2000)
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group flex flex-col gap-1 text-left">
        <div className="grid grid-cols-2 gap-px overflow-hidden border border-border/60 bg-muted/40">
          {items.length === 0 ? (
            <div className="col-span-2 flex aspect-square items-center justify-center">
              <span className={labelCls}>Empty outfit</span>
            </div>
          ) : (
            items.map((c, i) => (
              <div
                key={`${c.id}-${i}`}
                className={cn(
                  'aspect-square overflow-hidden bg-muted/40',
                  items.length % 2 === 1 && i === 0 && 'col-span-2',
                )}
              >
                <img src={c.path} alt={c.name} className="h-full w-full object-cover" loading="lazy" />
              </div>
            ))
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{outfit.name || 'Untitled outfit'}</p>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit outfit</DialogTitle>
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={onShare} disabled={!!shareNote} className="flex-1">
              {shareNote ?? 'Share outfit'}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(outfit.id)
                setOpen(false)
              }}
            >
              Delete outfit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CartSheet({
  cart,
  onClose,
  onRemove,
}: {
  cart: Clothing[]
  onClose: () => void
  onRemove: (id: number) => Promise<void>
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/25 backdrop-blur-[2px]" onClick={onClose}>
      <aside
        className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-2xl tracking-wide">Cart</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close cart">
            <X className="size-5" />
          </Button>
        </div>
        {cart.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing here yet — tap the bag on any product in Shop to park it for later.
          </p>
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
                    <button
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => onRemove(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  )
}

export default function App() {
  const wardrobe = useWardrobe()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<Tab>('shop')
  const [cartOpen, setCartOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [outfitQuery, setOutfitQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)

  const brands = [...new Set(wardrobe.clothing.map((c) => c.brand).filter(Boolean))]
  const markets = [...new Set(wardrobe.clothing.map(marketplaceOf).filter(Boolean))]

  useEffect(() => initTheme(), [])

  if (wardrobe.status === 'loading') {
    return <div className="p-8 text-muted-foreground">Loading…</div>
  }

  if (wardrobe.status === 'error') {
    return (
      <div className="mx-auto max-w-md p-8">
        <h1 className="mb-2 font-heading text-3xl tracking-wide">
          {wardrobe.opfsUnavailable ? 'Browser not supported' : 'Something went wrong'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {wardrobe.opfsUnavailable
            ? "Shiah's Closet stores your wardrobe in your browser (OPFS), which this browser does not support. Try a recent version of Chrome, Edge, Firefox, or Safari."
            : wardrobe.error}
        </p>
      </div>
    )
  }

  // Scrolling tab panel; Shop is the exception (full-height viewer, no page scroll).
  const scrollPanel = 'mx-auto w-full max-w-5xl flex-1 overflow-y-auto p-4 pb-24 sm:p-6 max-md:pb-28'

  return (
    <SidebarProvider className="h-dvh overflow-hidden">
      {/* Exactly one nav: JS-driven, so sidebar and bottom bar can never both show */}
      {!isMobile && (
        <AppSidebar tab={tab} onNavigate={setTab} cartCount={wardrobe.cart.length} onOpenCart={() => setCartOpen(true)} />
      )}
      <SidebarInset>
        {isMobile && (
          <header className="flex items-center justify-between pt-6 pb-4 max-md:px-4">
            <h1 className="font-heading text-2xl font-medium tracking-wide">Shiah's Closet</h1>
            <button
              className="relative border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setCartOpen(true)}
              aria-label="Open cart"
            >
              <ShoppingBag className="size-5" />
              {wardrobe.cart.length > 0 && (
                <span
                  aria-hidden
                  className="absolute -top-px -right-px flex h-4 min-w-4 items-center justify-center bg-primary text-[10px] font-medium text-primary-foreground"
                >
                  {wardrobe.cart.length}
                </span>
              )}
            </button>
          </header>
        )}

        <main className="flex min-h-0 flex-1 flex-col">
          {tab === 'shop' && <Shop wardrobe={wardrobe} />}
          {tab === 'wardrobe' && (
            <div className={scrollPanel}>
              <section className="mb-14">
                <h2 className={cn(sectionHeading, 'mb-4')}>Clothing library</h2>
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
                  <p className="p-4 text-sm text-muted-foreground">
                    Nothing here yet — tap + Save on an item in Shop.
                  </p>
                ) : (
                  (() => {
                    const shown = wardrobe.clothing.filter((c) => matchesQuery(c, query, filters))
                    return shown.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground">No matches.</p>
                    ) : (
                      <ClothingGrid value={shown} onRemove={(item) => wardrobe.deleteClothing(item.id)} />
                    )
                  })()
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className={sectionHeading}>Outfits</h2>
                  <Button
                    onClick={async () => {
                      setCreating(true)
                      await wardrobe.addOutfit()
                      setCreating(false)
                    }}
                    disabled={creating}
                  >
                    New outfit
                  </Button>
                </div>
                <Input
                  placeholder="Search outfits"
                  value={outfitQuery}
                  onChange={(e) => setOutfitQuery(e.target.value)}
                  className="mb-4"
                />
                {wardrobe.outfits.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No outfits yet — create one above.</p>
                ) : (
                  (() => {
                    const q = outfitQuery.trim().toLowerCase()
                    const shown = wardrobe.outfits.filter((o) => !q || o.name.toLowerCase().includes(q))
                    return shown.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No matching outfits.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                        {shown.map((outfit) => (
                          <OutfitTile
                            key={outfit.id}
                            outfit={outfit}
                            clothing={wardrobe.clothing}
                            onAssign={wardrobe.updateOutfitPiece}
                            onRename={wardrobe.renameOutfit}
                            onDelete={wardrobe.deleteOutfit}
                          />
                        ))}
                      </div>
                    )
                  })()
                )}
              </section>
            </div>
          )}
          {tab === 'tryon' && (
            <div className="flex min-h-0 flex-1 flex-col p-4 pb-20 sm:p-6 max-md:pb-16">
              <TryOn wardrobe={wardrobe} />
            </div>
          )}
          {tab === 'settings' && (
            <div className={scrollPanel}>
              <Settings wardrobe={wardrobe} />
            </div>
          )}
        </main>

        {isMobile && <MobileNav tab={tab} onNavigate={setTab} />}

        {cartOpen && (
          <CartSheet
            cart={wardrobe.cart}
            onClose={() => setCartOpen(false)}
            onRemove={(id) => wardrobe.setInCart(id, false)}
          />
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}