import type { DbRequest, DbResponse } from './protocol'
import type { BodyPhoto, Clothing, NewClothing, Outfit, OutfitSlot, TryOnResult } from '@/types'
export type { NewClothing } from '@/types'

// A clothing column we're allowed to edit directly (used by updateClothingPiece).
export type ClothingColumn = 'name' | 'path' | 'type' | 'brand' | 'url'

// Thrown when the database can't work (e.g. the browser doesn't support OPFS).
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

// DBManager is the app's ONLY way of talking to the database.
//
// The database itself lives inside a Web Worker (see ./worker.ts) because
// browsers only allow its storage type (OPFS) there. That means every
// database call has to cross a message boundary:
//
//   1. main thread sends a request:  { id, method, params }
//   2. worker runs the matching handler and sends back a response
//   3. main thread resolves the waiting Promise with the result
//
// send() below does all of that. Every other method is just a convenient,
// clearly-typed wrapper around it. The `as` casts in each method are safe:
// they describe the shape WE know the worker returns for that method.

export class DBManager {
  private worker: Worker
  // seq ("sequence") is a number we increase by 1 for every request, so each
  // request has a unique id. pending remembers which Promise is waiting on it.
  private seq = 0
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: DbError) => void }>()
  // Becomes "resolved" once the worker answers its first ping — callers
  // await db.ready before doing real work.
  readonly ready: Promise<void>

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    this.worker.addEventListener('message', (e: MessageEvent<DbResponse>) => {
      const msg = e.data
      const entry = this.pending.get(msg.id)
      if (!entry) return // answer to a request we already gave up on
      this.pending.delete(msg.id)
      if (msg.ok) entry.resolve(msg.result)
      else entry.reject(new DbError(msg.error ?? 'database error', msg.code))
    })
    this.ready = this.send('ping', []).then(() => undefined)
  }

  // Send one request to the worker and wait for its answer.
  // The answer arrives as plain "unknown" data — each method below
  // states what shape it should be.
  private send(method: string, params: unknown[]): Promise<unknown> {
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      const request: DbRequest = { id, method, params }
      this.worker.postMessage(request)
    })
  }

  // Same as send, but waits for the worker to be ready first.
  private async sendReady(method: string, params: unknown[]): Promise<unknown> {
    await this.ready
    return this.send(method, params)
  }

  // ---------- clothing ----------

  async addClothing(item: NewClothing): Promise<number> {
    return await this.sendReady('addClothing', [item]) as number
  }

  async getAllClothing(): Promise<Clothing[]> {
    return await this.sendReady('getAllClothing', []) as Clothing[]
  }

  async getClothing(id: number): Promise<Clothing | null> {
    return await this.sendReady('getClothing', [id]) as Clothing | null
  }

  async deleteClothing(id: number): Promise<void> {
    await this.sendReady('deleteClothing', [id])
  }

  async updateClothingPiece(id: number, column: ClothingColumn, value: string): Promise<void> {
    await this.sendReady('updateClothingPiece', [id, column, value])
  }

  // ---------- outfits ----------

  async addOutfit(outfit: NewOutfit): Promise<number> {
    return await this.sendReady('addOutfit', [outfit]) as number
  }

  async getOutfit(id: number): Promise<Outfit | null> {
    return await this.sendReady('getOutfit', [id]) as Outfit | null
  }

  async getAllOutfits(): Promise<Outfit[]> {
    return await this.sendReady('getAllOutfits', []) as Outfit[]
  }

  async deleteOutfit(id: number): Promise<void> {
    await this.sendReady('deleteOutfit', [id])
  }

  async updateOutfitPiece(outfitId: number, slot: OutfitSlot, clothingId: number | null): Promise<void> {
    await this.sendReady('updateOutfitPiece', [outfitId, slot, clothingId])
  }

  async renameOutfit(outfitId: number, name: string): Promise<void> {
    await this.sendReady('renameOutfit', [outfitId, name])
  }

  // ---------- cart ----------

  async setInCart(id: number, inCart: boolean): Promise<void> {
    await this.sendReady('setInCart', [id, inCart])
  }

  async getCart(): Promise<Clothing[]> {
    return await this.sendReady('getCart', []) as Clothing[]
  }

  // ---------- body photos ----------

  async addBodyPhoto(image: string): Promise<number> {
    return await this.sendReady('addBodyPhoto', [image]) as number
  }

  async getBodyPhotos(): Promise<BodyPhoto[]> {
    return await this.sendReady('getBodyPhotos', []) as BodyPhoto[]
  }

  async deleteBodyPhoto(id: number): Promise<void> {
    await this.sendReady('deleteBodyPhoto', [id])
  }

  // ---------- try-on history ----------

  async addTryon(image: string, refKind: 'item' | 'outfit', refId: number): Promise<number> {
    return await this.sendReady('addTryon', [image, refKind, refId]) as number
  }

  async getTryons(): Promise<TryOnResult[]> {
    return await this.sendReady('getTryons', []) as TryOnResult[]
  }

  async deleteTryon(id: number): Promise<void> {
    await this.sendReady('deleteTryon', [id])
  }

  // ---------- danger zone ----------

  async clearAll(): Promise<void> {
    await this.sendReady('clearAll', [])
  }
}

// ponytail: module singleton — one worker, one OPFS connection. Cached on
// globalThis so Vite hot-reloading this file reuses the live worker instead
// of spawning a second one that would trip OPFS's single-writer lock.
const g = globalThis as unknown as { __shivashonDb?: DBManager }
export const db: DBManager = (g.__shivashonDb ??= new DBManager())
