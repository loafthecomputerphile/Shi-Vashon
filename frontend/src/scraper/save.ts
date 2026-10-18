// save.ts — the one path that persists a product into the wardrobe DB.
// Used by both the catalog grid (Shop.tsx) and the minibrowser (Minibrowser.tsx).
import { toDataUrl } from './catalog'
import { findDupe } from './dupe'
import type { ScrapedProduct } from './scraper'
import type { NewClothing } from '../types'

// The pieces of the wardrobe a save needs: the current clothing list (for the
// dupe check) plus the DB methods to write with. Passed in as an object so
// this function can be tested without a real database.
export interface SaveDeps {
  clothing: { id: number; url: string | null; name: string; brand: string }[]
  addClothing: (item: NewClothing) => Promise<number>
  setInCart: (id: number, inCart: boolean) => Promise<void>
  brand: string
  price?: string
}

export type SaveResult = 'saved' | 'cart' | 'exists'

export async function saveProduct(
  p: ScrapedProduct,
  deps: SaveDeps,
  toCart = false,
): Promise<SaveResult> {
  // 1. Already in the wardrobe? Just flag it as "in cart" if asked, and stop.
  const existing = findDupe(deps.clothing, { url: p.url, name: p.name, brand: p.brand ?? deps.brand })
  if (existing) {
    if (toCart) await deps.setInCart(existing.id, true)
    return 'exists'
  }

  // 2. Download the image so the item works offline. If the download fails,
  //    keep the store's own image URL instead.
  let path = p.image ?? ''
  const downloaded = await toDataUrl(p.image ?? '')
  if (downloaded !== null) path = downloaded

  // 3. Store the item. (The scraper only produces products with a known
  //    type, so p.type is always set here.)
  const id = await deps.addClothing({
    name: p.name || 'Unnamed item',
    type: p.type!,
    brand: p.brand ?? deps.brand,
    url: p.url ?? '',
    path,
    price: deps.price ?? '',
  })
  if (toCart) await deps.setInCart(id, true)
  return toCart ? 'cart' : 'saved'
}
