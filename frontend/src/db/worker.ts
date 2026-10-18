import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite.mjs'
import * as SQLite from 'wa-sqlite'
import { AccessHandlePoolVFS } from 'wa-sqlite/src/examples/AccessHandlePoolVFS.js'
import wasmUrl from 'wa-sqlite/dist/wa-sqlite.wasm?url'
import type { DbRequest, DbResponse } from './protocol'
import type { Clothing, Outfit } from '@/types'

// worker.ts — all SQLite work happens in this dedicated worker file.
//
// Why a worker? The database is stored in OPFS (Origin Private File System),
// and browsers only allow OPFS's fast "sync access handles" inside workers.
// The main thread (DBManager.ts) sends us requests like 'getAllClothing'
// and we run the matching function from the `handlers` table below.

// Every SQLite row comes back as unknown[] — an array of values whose types
// we don't know from TypeScript's point of view. These two helpers convert
// a value to the type we know it has. This is the ONE place in the file
// where type casts happen.
const asNumber = (v: unknown): number => v as number
const asString = (v: unknown): string => v as string

// A worker has no `window`, so we grab the message functions from globalThis.
const ctx = globalThis as unknown as {
  postMessage: (m: DbResponse) => void
  addEventListener: (t: 'message', cb: (e: MessageEvent<DbRequest>) => void) => void
}

let sqlite3: SQLite.SQLiteAPI
let db: number

// Run a SELECT query and return every matching row as an array of arrays.
// rows[i][j] = the j-th column of the i-th row.
async function all(sql: string, params: unknown[] = []): Promise<unknown[][]> {
  const rows: unknown[][] = []
  for await (const stmt of sqlite3.statements(db, sql)) {
    sqlite3.bind_collection(stmt, params as SQLite.SQLITE_TYPE[])
    while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
      rows.push(sqlite3.row(stmt))
    }
  }
  return rows
}

// Run an INSERT / UPDATE / DELETE query and throw away the result.
async function run(sql: string, params: unknown[] = []): Promise<void> {
  await all(sql, params)
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS clothing (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL,
  path  TEXT NOT NULL,
  type  TEXT NOT NULL,
  brand TEXT NOT NULL,
  url   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS outfit (
  outfit_id INTEGER PRIMARY KEY AUTOINCREMENT,
  top    INTEGER REFERENCES clothing(id) ON DELETE SET NULL,
  bottom INTEGER REFERENCES clothing(id) ON DELETE SET NULL,
  hat    INTEGER REFERENCES clothing(id) ON DELETE SET NULL,
  dress  INTEGER REFERENCES clothing(id) ON DELETE SET NULL,
  jacket INTEGER REFERENCES clothing(id) ON DELETE SET NULL,
  name   TEXT NOT NULL DEFAULT ''
);
`

// The database starts at version 0. migrate() brings it up to the latest
// version step by step, so old databases get the new tables/columns added.
async function migrate(): Promise<void> {
  const rows = await all('PRAGMA user_version')
  const version = asNumber(rows[0][0])
  if (version < 1) {
    await sqlite3.exec(db, SCHEMA)
    await run('PRAGMA user_version = 1')
  }
  if (version < 2) {
    // v2: scraped-item fields + cart flag; new tables for photos & try-on history.
    // PRAGMA table_info lists the columns a table currently has.
    const cols = await all('PRAGMA table_info(clothing)')
    const names = cols.map((c) => asString(c[1]))
    if (!names.includes('price')) await run("ALTER TABLE clothing ADD COLUMN price TEXT NOT NULL DEFAULT ''")
    if (!names.includes('added_at')) await run("ALTER TABLE clothing ADD COLUMN added_at TEXT NOT NULL DEFAULT ''")
    if (!names.includes('in_cart')) await run('ALTER TABLE clothing ADD COLUMN in_cart INTEGER NOT NULL DEFAULT 0')
    await sqlite3.exec(db, `
      CREATE TABLE IF NOT EXISTS body_photo (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        image      TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS tryon (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        image      TEXT NOT NULL,
        ref_kind   TEXT NOT NULL,
        ref_id     INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `)
    await run('PRAGMA user_version = 2')
  }
}

// The columns of the clothing table, in SELECT order.
const CLOTHING_COLS = 'id, name, path, type, brand, url, price, added_at'
const CLOTHING_WIDTH = 8 // how many fields one clothing item takes in a row

// One outfit = 5 LEFT JOINs (one per slot) stitched into a single row:
// [outfit_id, name, top's 8 fields, bottom's 8 fields, ... jacket's 8 fields].
// An empty slot comes back as 8 nulls, which rowToClothing turns into null.
const OUTFIT_SELECT = `
SELECT
  o.outfit_id, o.name,
  t.id, t.name, t.path, t.type, t.brand, t.url, t.price, t.added_at,
  b.id, b.name, b.path, b.type, b.brand, b.url, b.price, b.added_at,
  h.id, h.name, h.path, h.type, h.brand, h.url, h.price, h.added_at,
  d.id, d.name, d.path, d.type, d.brand, d.url, d.price, d.added_at,
  j.id, j.name, j.path, j.type, j.brand, j.url, j.price, j.added_at
FROM outfit o
LEFT JOIN clothing t ON t.id = o.top
LEFT JOIN clothing b ON b.id = o.bottom
LEFT JOIN clothing h ON h.id = o.hat
LEFT JOIN clothing d ON d.id = o.dress
LEFT JOIN clothing j ON j.id = o.jacket
`

// Convert one clothing row (8 plain values) into a Clothing object.
// Returns null when the row is empty (i.e. that outfit slot is vacant).
function rowToClothing(row: unknown[] | null): Clothing | null {
  if (!row || row[0] === null) return null
  return {
    id: asNumber(row[0]),
    name: asString(row[1]),
    path: asString(row[2]),
    type: asString(row[3]) as Clothing['type'],
    brand: asString(row[4]),
    url: asString(row[5]),
    price: row[6] === null ? '' : asString(row[6]),
    added_at: row[7] === null ? '' : asString(row[7]),
  }
}

// The outfit fields take 2 spots, then each of the 5 slots takes 8.
const OUTFIT_FIRST_SLOT_START = 2
// Get the 8 fields belonging to slot number `slotIndex` (0 = top ... 4 = jacket).
function slotFields(row: unknown[], slotIndex: number): unknown[] {
  const start = OUTFIT_FIRST_SLOT_START + slotIndex * CLOTHING_WIDTH
  return row.slice(start, start + CLOTHING_WIDTH)
}

// Convert one long outfit row into an Outfit object.
function rowToOutfit(row: unknown[]): Outfit {
  return {
    id: asNumber(row[0]),
    name: asString(row[1]),
    top: rowToClothing(slotFields(row, 0)),
    bottom: rowToClothing(slotFields(row, 1)),
    hat: rowToClothing(slotFields(row, 2)),
    dress: rowToClothing(slotFields(row, 3)),
    jacket: rowToClothing(slotFields(row, 4)),
  }
}

// When adding an outfit we only know the clothing ids for each slot.
interface OutfitInsert {
  name: string
  top?: number | null
  bottom?: number | null
  hat?: number | null
  dress?: number | null
  jacket?: number | null
}

// Get the id SQLite just assigned to the row we last inserted.
async function lastInsertedId(): Promise<number> {
  const rows = await all('SELECT last_insert_rowid()')
  return asNumber(rows[0][0])
}

// handlers — every method the main thread can ask for. Each one receives
// the request's params as a list and returns the answer. The worker's
// message listener at the bottom looks the method up here and runs it.
type DbHandler = (params: unknown[]) => Promise<unknown>
const handlers: Record<string, DbHandler> = {
  ping: async () => true,

  addClothing: async (params) => {
    const item = params[0] as Omit<Clothing, 'id'>
    await run(
      "INSERT INTO clothing (name, path, type, brand, url, price, added_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
      [item.name, item.path, item.type, item.brand, item.url, item.price ?? ''],
    )
    return await lastInsertedId()
  },

  getAllClothing: async () => {
    const rows = await all(`SELECT ${CLOTHING_COLS} FROM clothing ORDER BY id DESC`)
    return rows.map(rowToClothingRow)
  },

  getClothing: async (params) => {
    const id = params[0]
    const rows = await all(`SELECT ${CLOTHING_COLS} FROM clothing WHERE id = ?`, [id])
    return rows.length ? rows[0] : null
  },

  deleteClothing: async (params) => {
    const id = params[0]
    await run('DELETE FROM clothing WHERE id = ?', [id])
  },

  updateClothingPiece: async (params) => {
    const [id, column, value] = params
    // ponytail: column is pasted into the SQL, so it's checked against a
    // whitelist of known column names first — values still go through ?.
    const allowedColumns = ['name', 'path', 'type', 'brand', 'url']
    if (!allowedColumns.includes(column as string)) {
      throw new Error(`Invalid clothing column: ${column}`)
    }
    await run(`UPDATE clothing SET ${column} = ? WHERE id = ?`, [value, id])
  },

  addOutfit: async (params) => {
    const outfit = params[0] as OutfitInsert
    await run(
      'INSERT INTO outfit (top, bottom, hat, dress, jacket, name) VALUES (?, ?, ?, ?, ?, ?)',
      [
        outfit.top ?? null, outfit.bottom ?? null,
        outfit.hat ?? null, outfit.dress ?? null, outfit.jacket ?? null,
        outfit.name ?? '',
      ],
    )
    return await lastInsertedId()
  },

  getOutfit: async (params) => {
    const id = params[0]
    const rows = await all(`${OUTFIT_SELECT} WHERE o.outfit_id = ?`, [id])
    return rows.length ? rowToOutfit(rows[0]) : null
  },

  getAllOutfits: async () => {
    const rows = await all(OUTFIT_SELECT)
    return rows.map(rowToOutfit)
  },

  deleteOutfit: async (params) => {
    const id = params[0]
    await run('DELETE FROM outfit WHERE outfit_id = ?', [id])
  },

  updateOutfitPiece: async (params) => {
    const [outfitId, slot, value] = params
    // ponytail: slot is pasted into the SQL, whitelist-checked first.
    const allowedSlots = ['top', 'bottom', 'hat', 'dress', 'jacket']
    if (!allowedSlots.includes(slot as string)) {
      throw new Error(`Invalid outfit slot: ${slot}`)
    }
    await run(`UPDATE outfit SET ${slot} = ? WHERE outfit_id = ?`, [value, outfitId])
  },

  renameOutfit: async (params) => {
    const [outfitId, name] = params
    await run('UPDATE outfit SET name = ? WHERE outfit_id = ?', [name, outfitId])
  },

  // Cart is a flag on clothing — one source of truth, so cart entries carry
  // name/price/image for free.
  setInCart: async (params) => {
    const [id, inCart] = params
    await run('UPDATE clothing SET in_cart = ? WHERE id = ?', [inCart ? 1 : 0, id])
  },

  getCart: async () => {
    const rows = await all(`SELECT ${CLOTHING_COLS} FROM clothing WHERE in_cart = 1 ORDER BY id DESC`)
    return rows.map(rowToClothingRow)
  },

  addBodyPhoto: async (params) => {
    const image = params[0]
    await run('INSERT INTO body_photo (image) VALUES (?)', [image])
    return await lastInsertedId()
  },

  getBodyPhotos: async () => {
    const rows = await all('SELECT id, image, created_at FROM body_photo ORDER BY id DESC')
    return rows.map((r) => ({
      id: asNumber(r[0]),
      image: asString(r[1]),
      created_at: asString(r[2]),
    }))
  },

  deleteBodyPhoto: async (params) => {
    const id = params[0]
    await run('DELETE FROM body_photo WHERE id = ?', [id])
  },

  addTryon: async (params) => {
    const [image, refKind, refId] = params
    await run('INSERT INTO tryon (image, ref_kind, ref_id) VALUES (?, ?, ?)', [image, refKind, refId])
    return await lastInsertedId()
  },

  getTryons: async () => {
    const rows = await all('SELECT id, image, ref_kind, ref_id, created_at FROM tryon ORDER BY id DESC LIMIT 50')
    return rows.map((r) => ({
      id: asNumber(r[0]),
      image: asString(r[1]),
      ref_kind: asString(r[2]) as 'item' | 'outfit',
      ref_id: asNumber(r[3]),
      created_at: asString(r[4]),
    }))
  },

  deleteTryon: async (params) => {
    const id = params[0]
    await run('DELETE FROM tryon WHERE id = ?', [id])
  },

  clearAll: async () => {
    await run('DELETE FROM tryon')
    await run('DELETE FROM body_photo')
    await run('DELETE FROM outfit')
    await run('DELETE FROM clothing')
  },
}

// Map a flat clothing SELECT row onto a Clothing object (same fields as
// rowToClothing but always a full row, never nulls).
function rowToClothingRow(r: unknown[]): Clothing {
  return {
    id: asNumber(r[0]),
    name: asString(r[1]),
    path: asString(r[2]),
    type: asString(r[3]) as Clothing['type'],
    brand: asString(r[4]),
    url: asString(r[5]),
    price: r[6] === null ? '' : asString(r[6]),
    added_at: r[7] === null ? '' : asString(r[7]),
  }
}

async function initWorker(): Promise<void> {
  const module = await SQLiteESMFactory({ locateFile: () => wasmUrl })
  sqlite3 = SQLite.Factory(module)
  const vfs = new AccessHandlePoolVFS('/')
  await vfs.isReady
  await sqlite3.vfs_register(vfs, true)
  // The OPFS file allows one connection. After a Vite hot-reload the previous
  // worker may still hold the handles for a moment — retry instead of
  // failing into the opfs-unavailable error screen.
  for (let attempt = 0; ; attempt++) {
    try {
      db = await sqlite3.open_v2(
        'shi-vashon.sqlite',
        SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE,
        'AccessHandlePool',
      )
      break
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (attempt >= 5 || !msg.includes('Access Handle')) throw err
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  // Per-connection setting; one connection lives for the worker's lifetime.
  await sqlite3.exec(db, 'PRAGMA foreign_keys = ON;')
  await migrate()
}

// ponytail: single-tab assumption — AccessHandlePoolVFS allows one connection
// per DB file; a second tab gets the opfs-unavailable error state. Upgrade path:
// OPFSAnyContextVFS or SharedWorker if multi-tab ever matters.
let initFailed = false

// The worker's entry point: for every message from the main thread,
// look up the method in `handlers`, run it, and send the answer back.
ctx.addEventListener('message', async (e: MessageEvent<DbRequest>) => {
  const { id, method, params } = e.data
  let response: DbResponse
  try {
    if (!sqlite3 && !initFailed) await initWorker()
    if (!handlers[method]) throw new Error(`Unknown method: ${method}`)
    const result = await handlers[method](params ?? [])
    response = { id, ok: true, result }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isOpfs =
      !sqlite3 &&
      (msg.includes('OPFS') ||
        msg.includes('opfs') ||
        msg.includes('getDirectory') ||
        msg.includes('FileSystemSyncAccessHandle') ||
        msg.includes('createSyncAccessHandle'))
    if (!sqlite3) initFailed = true
    response = isOpfs
      ? { id, ok: false, error: msg, code: 'opfs-unavailable' }
      : { id, ok: false, error: msg, code: 'db-error' }
  }
  ctx.postMessage(response)
})
