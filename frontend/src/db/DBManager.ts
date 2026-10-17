import type { DbRequest, DbResponse } from './protocol'
import type { BodyPhoto, Clothing, NewClothing, Outfit, OutfitSlot, TryOnResult } from '@/types'
export type { NewClothing } from '@/types'

export type ClothingColumn = 'name' | 'path' | 'type' | 'brand' | 'url'

export class DbError extends Error {
  code?: 'opfs-unavailable' | 'db-error'
  constructor(message: string, code?: 'opfs-unavailable' | 'db-error') {
    super(message)
    this.code = code
  }
}

export type NewOutfit = {
  name: string
  top?: number | null
  bottom?: number | null
  hat?: number | null
  dress?: number | null
  jacket?: number | null
}

// Main-thread async client mirroring the DBManager surface from
// backend/src/db.py. Async because every call crosses the worker boundary.

export class DBManager {
  private worker: Worker
  private seq = 0
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: DbError) => void }>()
  readonly ready: Promise<void>

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    this.worker.addEventListener('message', (e: MessageEvent<DbResponse>) => {
      const msg = e.data
      const entry = this.pending.get(msg.id)
      if (!entry) return
      this.pending.delete(msg.id)
      if (msg.ok) entry.resolve(msg.result)
      else entry.reject(new DbError(msg.error, msg.code))
    })
    this.ready = this.call('ping', []).then(() => undefined)
  }

  private call<T>(method: string, params: unknown[]): Promise<T> {
    const id = ++this.seq
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      this.worker.postMessage({ id, method, params } satisfies DbRequest)
    })
  }

  private async op<T>(method: string, params: unknown[]): Promise<T> {
    await this.ready
    return this.call<T>(method, params)
  }

  addClothing(item: NewClothing): Promise<number> {
    return this.op<number>('addClothing', [item])
  }
  getAllClothing(): Promise<Clothing[]> {
    return this.op<Clothing[]>('getAllClothing', [])
  }
  getClothing(id: number): Promise<Clothing | null> {
    return this.op<Clothing | null>('getClothing', [id])
  }
  deleteClothing(id: number): Promise<void> {
    return this.op<void>('deleteClothing', [id])
  }
  updateClothingPiece(id: number, column: ClothingColumn, value: string): Promise<void> {
    return this.op<void>('updateClothingPiece', [id, column, value])
  }

  addOutfit(outfit: NewOutfit): Promise<number> {
    return this.op<number>('addOutfit', [outfit])
  }
  getOutfit(id: number): Promise<Outfit | null> {
    return this.op<Outfit | null>('getOutfit', [id])
  }
  getAllOutfits(): Promise<Outfit[]> {
    return this.op<Outfit[]>('getAllOutfits', [])
  }
  deleteOutfit(id: number): Promise<void> {
    return this.op<void>('deleteOutfit', [id])
  }
  updateOutfitPiece(outfitId: number, slot: OutfitSlot, clothingId: number | null): Promise<void> {
    return this.op<void>('updateOutfitPiece', [outfitId, slot, clothingId])
  }
  renameOutfit(outfitId: number, name: string): Promise<void> {
    return this.op<void>('renameOutfit', [outfitId, name])
  }

  setInCart(id: number, inCart: boolean): Promise<void> {
    return this.op<void>('setInCart', [id, inCart])
  }
  getCart(): Promise<Clothing[]> {
    return this.op<Clothing[]>('getCart', [])
  }

  addBodyPhoto(image: string): Promise<number> {
    return this.op<number>('addBodyPhoto', [image])
  }
  getBodyPhotos(): Promise<BodyPhoto[]> {
    return this.op<BodyPhoto[]>('getBodyPhotos', [])
  }
  deleteBodyPhoto(id: number): Promise<void> {
    return this.op<void>('deleteBodyPhoto', [id])
  }

  addTryon(image: string, refKind: 'item' | 'outfit', refId: number): Promise<number> {
    return this.op<number>('addTryon', [image, refKind, refId])
  }
  getTryons(): Promise<TryOnResult[]> {
    return this.op<TryOnResult[]>('getTryons', [])
  }
  deleteTryon(id: number): Promise<void> {
    return this.op<void>('deleteTryon', [id])
  }

  clearAll(): Promise<void> {
    return this.op<void>('clearAll', [])
  }
}

// ponytail: module singleton — one worker, one OPFS connection. Cached on
// globalThis so Vite HMR re-executing this module reuses the live worker
// instead of spawning a second one that would trip OPFS's single-writer lock.
const g = globalThis as unknown as { __shivashonDb?: DBManager }
export const db: DBManager = (g.__shivashonDb ??= new DBManager())
