import { Suspense, lazy, useEffect, useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import {
  SidebarInset, SidebarProvider,
} from '@/components/ui/sidebar'
import { useWardrobe } from '@/hooks/useWardrobe'
import { useIsMobile } from '@/hooks/use-mobile'
import { initTheme } from '@/lib/prefs'
import { IconButton } from '@/components/kit/buttons'
import { Heading } from '@/components/kit/tiles'
import { CountBadge, useToast } from '@/components/kit/feedback'
import { ScrollPanel } from '@/components/kit/layout'
import { SLOTS, type Tab } from '@/components/app/nav-shared'
import AppSidebar from '@/components/app/AppSidebar'
import MobileNav from '@/components/app/MobileNav'
import Overlays from '@/components/app/Overlays'
import type { Clothing, Outfit } from '@/types'
import { NO_FILTERS, type Filters } from '@/lib/filters'

// App.tsx — the app shell. Holds which tab is open and the undo/delete
// handlers, then renders the active tab, the nav bars, and the overlays
// (cart drawer + toast). Each tab loads in its own lazy chunk so the
// first paint stays small. The tab screens live in their own files:
// Shop, TryOn, Settings, app/WardrobeView.

const Shop = lazy(() => import('@/components/Shop'))
const TryOn = lazy(() => import('@/components/TryOn'))
const Settings = lazy(() => import('@/components/Settings'))
const WardrobeView = lazy(() => import('@/components/app/WardrobeView'))

// Simple placeholder shown while a tab chunk is downloading.
function TabFallback() {
  return <div className="p-8 text-muted-foreground">Loading…</div>
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
          <Suspense fallback={<TabFallback />}>
            {tab === 'shop' && <Shop wardrobe={wardrobe} onSaved={onSavedFromShop} />}
            {tab === 'wardrobe' && (
              <WardrobeView
                wardrobe={wardrobe}
                query={query}
                setQuery={setQuery}
                filters={filters}
                setFilters={setFilters}
                outfitQuery={outfitQuery}
                setOutfitQuery={setOutfitQuery}
                creatingId={creatingId}
                setCreatingId={setCreatingId}
                onDeleteClothing={deleteClothingWithUndo}
                onDeleteOutfit={deleteOutfitWithUndo}
                onBrowseShop={() => setTab('shop')}
              />
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
          </Suspense>
        </main>

        {isMobile && <MobileNav tab={tab} onNavigate={setTab} />}

        <Overlays
          cart={wardrobe.cart}
          cartOpen={cartOpen}
          setCartOpen={setCartOpen}
          onRemoveFromCart={(id) => wardrobe.setInCart(id, false)}
          toast={toast}
          dismissToast={dismiss}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
