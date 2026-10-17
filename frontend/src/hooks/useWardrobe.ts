import { useCallback, useEffect, useState } from 'react'
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

// Thin state layer over the DBManager singleton: load on mount, mutate,
// refresh from the DB after each write. No state library.

export function useWardrobe() {
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
        const [clothing, outfits, cart, photos, tryons] = await Promise.all([
          db.getAllClothing(), db.getAllOutfits(), db.getCart(), db.getBodyPhotos(), db.getTryons(),
        ])
        if (!cancelled) setState((s) => ({ ...s, status: 'ready', clothing, outfits, cart, photos, tryons }))
      } catch (err) {
        if (cancelled) return
        const e = err instanceof DbError ? err : null
        setState((s) => ({
          ...s,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
          opfsUnavailable: e?.code === 'opfs-unavailable',
        }))
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const refresh = useCallback(async () => {
    const [clothing, outfits, cart, photos, tryons] = await Promise.all([
      db.getAllClothing(), db.getAllOutfits(), db.getCart(), db.getBodyPhotos(), db.getTryons(),
    ])
    setState((s) => ({ ...s, status: 'ready', clothing, outfits, cart, photos, tryons }))
  }, [])

  const addClothing = useCallback(
    async (item: NewClothing) => {
      const id = await db.addClothing(item)
      await refresh()
      return id
    },
    [refresh],
  )

  const deleteClothing = useCallback(
    async (id: number) => {
      await db.deleteClothing(id)
      await refresh() // ON DELETE SET NULL may have cleared outfit slots too
    },
    [refresh],
  )

  const setInCart = useCallback(
    async (id: number, inCart: boolean) => {
      await db.setInCart(id, inCart)
      await refresh()
    },
    [refresh],
  )

  const addOutfit = useCallback(async () => {
    const id = await db.addOutfit({ name: '' })
    await refresh()
    return id
  }, [refresh])

  const deleteOutfit = useCallback(
    async (id: number) => {
      await db.deleteOutfit(id)
      await refresh()
    },
    [refresh],
  )

  const updateOutfitPiece = useCallback(
    async (outfitId: number, slot: OutfitSlot, clothingId: number | null) => {
      await db.updateOutfitPiece(outfitId, slot, clothingId)
      await refresh()
    },
    [refresh],
  )

  const renameOutfit = useCallback(
    async (id: number, name: string) => {
      await db.renameOutfit(id, name)
      await refresh()
    },
    [refresh],
  )

  const addPhoto = useCallback(
    async (image: string) => {
      await db.addBodyPhoto(image)
      await refresh()
    },
    [refresh],
  )

  const deletePhoto = useCallback(
    async (id: number) => {
      await db.deleteBodyPhoto(id)
      await refresh()
    },
    [refresh],
  )

  const addTryon = useCallback(
    async (image: string, refKind: 'item' | 'outfit', refId: number) => {
      await db.addTryon(image, refKind, refId)
      await refresh()
    },
    [refresh],
  )

  const deleteTryon = useCallback(
    async (id: number) => {
      await db.deleteTryon(id)
      await refresh()
    },
    [refresh],
  )

  const clearAll = useCallback(async () => {
    await db.clearAll()
    await refresh()
  }, [refresh])

  return {
    ...state, addClothing, deleteClothing, setInCart, addOutfit, deleteOutfit,
    updateOutfitPiece, renameOutfit, addPhoto, deletePhoto, addTryon, deleteTryon, clearAll,
  }
}
