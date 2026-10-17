import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite.mjs'
import * as SQLite from 'wa-sqlite'
import { AccessHandlePoolVFS } from 'wa-sqlite/src/examples/AccessHandlePoolVFS.js'
import wasmUrl from 'wa-sqlite/dist/wa-sqlite.wasm?url'
import type { DbRequest, DbResponse } from './protocol'
import type { Clothing, Outfit } from '@/types'

// All SQLite work happens in this dedicated worker: OPFS sync access handles
// exist only in workers. Main thread talks to us via the protocol in protocol.ts.

const ctx = globalThis as unknown as {
  postMessage: (m: DbResponse) => void
  addEventListener: (t: 'message', cb: (e: MessageEvent<DbRequest>) => void) => void
}

let sqlite3: SQLite.SQLiteAPI
let db: number

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

async function migrate(): Promise<void> {
  const rows = await all('PRAGMA user_version')
  const version = rows[0][0] as number
  if (version < 1) {
    await sqlite3.exec(db, SCHEMA)
    await run('PRAGMA user_version = 1')
  }
  if (version < 2) {
    // v2: scraped-item fields + cart flag; new tables for photos & try-on history.
    const cols = await all('PRAGMA table_info(clothing)')
    const names = cols.map((c) => c[1])
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

// Single LEFT JOIN per outfit — replaces the Python N+1 hydration.
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

const CLOTHING_COLS = 'id, name, path, type, brand, url, price, added_at'
const CLOTHING_WIDTH = 8 // fields per joined clothing row

function rowToClothing(row: unknown[] | null): Clothing | null {
  if (!row || row[0] === null) return null
  return {
    id: row[0] as number,
    name: row[1] as string,
    path: row[2] as string,
    type: row[3] as Clothing['type'],
    brand: row[4] as string,
    url: row[5] as string,
    price: (row[6] as string) ?? '',
    added_at: (row[7] as string) ?? '',
  }
}

function rowToOutfit(row: unknown[]): Outfit {
  return {
    id: row[0] as number,
    name: row[1] as string,
    top: rowToClothing(row.slice(2, 2 + CLOTHING_WIDTH)),
    bottom: rowToClothing(row.slice(2 + CLOTHING_WIDTH, 2 + CLOTHING_WIDTH * 2)),
    hat: rowToClothing(row.slice(2 + CLOTHING_WIDTH * 2, 2 + CLOTHING_WIDTH * 3)),
    dress: rowToClothing(row.slice(2 + CLOTHING_WIDTH * 3, 2 + CLOTHING_WIDTH * 4)),
    jacket: rowToClothing(row.slice(2 + CLOTHING_WIDTH * 4, 2 + CLOTHING_WIDTH * 5)),
  }
}

interface OutfitInsert {
  name: string
  top?: number | null
  bottom?: number | null
  hat?: number | null
  dress?: number | null
  jacket?: number | null
}

const handlers: Record<string, (params: unknown[]) => Promise<unknown>> = {
  ping: async () => true,

  addClothing: async ([item]) => {
    const c = item as Omit<Clothing, 'id'>
    await run('INSERT INTO clothing (name, path, type, brand, url, price, added_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))', [
      c.name, c.path, c.type, c.brand, c.url, c.price ?? '',
    ])
    const rows = await all('SELECT last_insert_rowid()')
    return rows[0][0] as number
  },

  getAllClothing: async () => {
    const rows = await all(`SELECT ${CLOTHING_COLS} FROM clothing ORDER BY id DESC`)
    return rows.map((r) => ({
      id: r[0], name: r[1], path: r[2], type: r[3], brand: r[4], url: r[5], price: r[6], added_at: r[7],
    }))
  },

  getClothing: async ([id]) => {
    const rows = await all(`SELECT ${CLOTHING_COLS} FROM clothing WHERE id = ?`, [id])
    return rows.length ? rows[0] : null
  },

  deleteClothing: async ([id]) => {
    await run('DELETE FROM clothing WHERE id = ?', [id])
  },

  updateClothingPiece: async ([id, column, value]) => {
    const cols = ['name', 'path', 'type', 'brand', 'url']
    if (!cols.includes(column as string)) throw new Error(`Invalid clothing column: ${column}`)
    await run(`UPDATE clothing SET ${column} = ? WHERE id = ?`, [value, id])
  },

  addOutfit: async ([o]) => {
    const outfit = o as OutfitInsert
    await run(
      'INSERT INTO outfit (top, bottom, hat, dress, jacket, name) VALUES (?, ?, ?, ?, ?, ?)',
      [
        outfit.top ?? null, outfit.bottom ?? null,
        outfit.hat ?? null, outfit.dress ?? null, outfit.jacket ?? null,
        outfit.name ?? '',
      ],
    )
    const rows = await all('SELECT last_insert_rowid()')
    return rows[0][0] as number
  },

  getOutfit: async ([id]) => {
    const rows = await all(`${OUTFIT_SELECT} WHERE o.outfit_id = ?`, [id])
    return rows.length ? rowToOutfit(rows[0]) : null
  },

  getAllOutfits: async () => {
    const rows = await all(OUTFIT_SELECT)
    return rows.map(rowToOutfit)
  },

  deleteOutfit: async ([id]) => {
    await run('DELETE FROM outfit WHERE outfit_id = ?', [id])
  },

  updateOutfitPiece: async ([outfitId, slot, value]) => {
    const slots = ['top', 'bottom', 'hat', 'dress', 'jacket']
    if (!slots.includes(slot as string)) throw new Error(`Invalid outfit slot: ${slot}`)
    await run(`UPDATE outfit SET ${slot} = ? WHERE outfit_id = ?`, [value, outfitId])
  },

  renameOutfit: async ([outfitId, name]) => {
    await run('UPDATE outfit SET name = ? WHERE outfit_id = ?', [name, outfitId])
  },

  // Cart is a flag on clothing — one source of truth, lines carry name/price/image for free.
  setInCart: async ([id, inCart]) => {
    await run('UPDATE clothing SET in_cart = ? WHERE id = ?', [inCart ? 1 : 0, id])
  },

  getCart: async () => {
    const rows = await all(`SELECT ${CLOTHING_COLS} FROM clothing WHERE in_cart = 1 ORDER BY id DESC`)
    return rows.map((r) => ({
      id: r[0], name: r[1], path: r[2], type: r[3], brand: r[4], url: r[5], price: r[6], added_at: r[7],
    }))
  },

  addBodyPhoto: async ([image]) => {
    await run('INSERT INTO body_photo (image) VALUES (?)', [image])
    const rows = await all('SELECT last_insert_rowid()')
    return rows[0][0] as number
  },

  getBodyPhotos: async () => {
    const rows = await all('SELECT id, image, created_at FROM body_photo ORDER BY id DESC')
    return rows.map((r) => ({ id: r[0], image: r[1], created_at: r[2] }))
  },

  deleteBodyPhoto: async ([id]) => {
    await run('DELETE FROM body_photo WHERE id = ?', [id])
  },

  addTryon: async ([image, refKind, refId]) => {
    await run('INSERT INTO tryon (image, ref_kind, ref_id) VALUES (?, ?, ?)', [image, refKind, refId])
    const rows = await all('SELECT last_insert_rowid()')
    return rows[0][0] as number
  },

  getTryons: async () => {
    const rows = await all('SELECT id, image, ref_kind, ref_id, created_at FROM tryon ORDER BY id DESC LIMIT 50')
    return rows.map((r) => ({ id: r[0], image: r[1], ref_kind: r[2], ref_id: r[3], created_at: r[4] }))
  },

  deleteTryon: async ([id]) => {
    await run('DELETE FROM tryon WHERE id = ?', [id])
  },

  clearAll: async () => {
    await run('DELETE FROM tryon')
    await run('DELETE FROM body_photo')
    await run('DELETE FROM outfit')
    await run('DELETE FROM clothing')
  },
}

async function initWorker(): Promise<void> {
  const module = await SQLiteESMFactory({ locateFile: () => wasmUrl })
  sqlite3 = SQLite.Factory(module)
  const vfs = new AccessHandlePoolVFS('/')
  await vfs.isReady
  await sqlite3.vfs_register(vfs, true)
  // The OPFS file allows one connection. After a Vite HMR swap the previous
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
