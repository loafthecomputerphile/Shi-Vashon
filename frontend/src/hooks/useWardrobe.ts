import { useEffect, useState } from 'react'
import { db, DbError } from '@/db/DBManager'
import type { BodyPhoto, Clothing, NewClothing, Outfit, OutfitSlot, TryOnResult } from '@/types'

export type DbStatus = 'loading' | 'ready' | 'error'

interface WardrobeState {
  status: DbStatus
  error: string | null
  opfsUnavailable: boolean
  clothing: Clothing[]
  outfits: Outfit[]
  cart: Clothing[]
  photos: BodyPhoto[]
  tryons: TryOnResult[]
}

// The full value useWardrobe returns: the state above plus every action.
// Spelled out as a plain interface (instead of ReturnType<typeof useWardrobe>)
// so any component can import it and see exactly what it gets.
export interface Wardrobe extends WardrobeState {
  refresh: () => Promise<void>
  addClothing: (item: NewClothing) => Promise<number>
  deleteClothing: (id: number) => Promise<void>
  setInCart: (id: number, inCart: boolean) => Promise<void>
  addOutfit: () => Promise<number>
  deleteOutfit: (id: number) => Promise<void>
  updateOutfitPiece: (outfitId: number, slot: OutfitSlot, clothingId: number | null) => Promise<void>
  renameOutfit: (id: number, name: string) => Promise<void>
  addPhoto: (image: string) => Promise<void>
  deletePhoto: (id: number) => Promise<void>
  addTryon: (image: string, refKind: 'item' | 'outfit', refId: number) => Promise<void>
  deleteTryon: (id: number) => Promise<void>
  clearAll: () => Promise<void>
}

// useWardrobe — the app's single source of wardrobe state.
//
// Thin state layer over the DBManager singleton (db in db/DBManager.ts):
// load everything on mount, then after each write, read everything back
// from the database. No state library, no caches — the DB is the truth.
//
// Most functions below follow the same two-step shape:
//   1. do the write in the database
//   2. call refresh() so the UI shows the new state
export function useWardrobe(): Wardrobe {
  const [state, setState] = useState<WardrobeState>({
    status: 'loading',
    error: null,
    opfsUnavailable: false,
    clothing: [],
    outfits: [],
    cart: [],
    photos: [],
    tryons: [],
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await db.ready
        // ponytail: read the five tables one after another instead of in
        // parallel — simpler to read, and the tiny slowdown only happens
        // once, on app start.
        const clothing = await db.getAllClothing()
        const outfits = await db.getAllOutfits()
        const cart = await db.getCart()
        const photos = await db.getBodyPhotos()
        const tryons = await db.getTryons()
        if (!cancelled) {
          setState((s) => ({ ...s, status: 'ready', clothing, outfits, cart, photos, tryons }))
        }
      } catch (err) {
        if (cancelled) return
        // Remember whether this was an OPFS problem (browser doesn't support
        // the private file system) so the UI can show a specific message.
        let opfsUnavailable = false
        if (err instanceof DbError && err.code === 'opfs-unavailable') {
          opfsUnavailable = true
        }
        const message = err instanceof Error ? err.message : String(err)
        setState((s) => ({ ...s, status: 'error', error: message, opfsUnavailable }))
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Read every table back into state. Called after every write below.
  async function refresh() {
    // ponytail: sequential reads — same reasoning as in load() above.
    const clothing = await db.getAllClothing()
    const outfits = await db.getAllOutfits()
    const cart = await db.getCart()
    const photos = await db.getBodyPhotos()
    const tryons = await db.getTryons()
    setState((s) => ({ ...s, status: 'ready', clothing, outfits, cart, photos, tryons }))
  }

  async function addClothing(item: NewClothing): Promise<number> {
    const id = await db.addClothing(item)
    await refresh()
    return id
  }

  async function deleteClothing(id: number) {
    await db.deleteClothing(id)
    await refresh() // ON DELETE SET NULL may have cleared outfit slots too
  }

  async function setInCart(id: number, inCart: boolean) {
    await db.setInCart(id, inCart)
    await refresh()
  }

  async function addOutfit(): Promise<number> {
    const id = await db.addOutfit({ name: '' })
    await refresh()
    return id
  }

  async function deleteOutfit(id: number) {
    await db.deleteOutfit(id)
    await refresh()
  }

  async function updateOutfitPiece(outfitId: number, slot: OutfitSlot, clothingId: number | null) {
    await db.updateOutfitPiece(outfitId, slot, clothingId)
    await refresh()
  }

  async function renameOutfit(id: number, name: string) {
    await db.renameOutfit(id, name)
    await refresh()
  }

  async function addPhoto(image: string) {
    await db.addBodyPhoto(image)
    await refresh()
  }

  async function deletePhoto(id: number) {
    await db.deleteBodyPhoto(id)
    await refresh()
  }

  async function addTryon(image: string, refKind: 'item' | 'outfit', refId: number) {
    await db.addTryon(image, refKind, refId)
    await refresh()
  }

  async function deleteTryon(id: number) {
    await db.deleteTryon(id)
    await refresh()
  }

  async function clearAll() {
    await db.clearAll()
    await refresh()
  }

  return {
    ...state, refresh, addClothing, deleteClothing, setInCart, addOutfit, deleteOutfit,
    updateOutfitPiece, renameOutfit, addPhoto, deletePhoto, addTryon, deleteTryon, clearAll,
  }
}
