// save.ts — the one path that persists a product into the wardrobe DB.
// Used by both the catalog grid (Shop.tsx) and the minibrowser (Minibrowser.tsx).
import { toDataUrl } from './catalog'
import { findDupe } from './dupe'
import type { ScrapedProduct } from './scraper'
import type { NewClothing } from '../types'

export interface SaveDeps {
  clothing: { url: string | null; name: string; brand: string; id: number }[]
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
  const existing = findDupe(deps.clothing, { url: p.url, name: p.name, brand: p.brand ?? deps.brand })
  if (existing) {
    if (toCart) await deps.setInCart(existing.id, true)
    return 'exists'
  }
  const path = (await toDataUrl(p.image ?? '')) ?? p.image ?? ''
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
