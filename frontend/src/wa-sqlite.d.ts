// wa-sqlite ships no type declarations — declare the pieces worker.ts uses as any.
declare module 'wa-sqlite' {
  export const SQLITE_ROW: number
  export const SQLITE_OPEN_CREATE: number
  export const SQLITE_OPEN_READWRITE: number
  export type SQLiteAPI = any
  export type SQLITE_TYPE = any
  export const Factory: (module: unknown) => SQLiteAPI
  export const statements: (db: number, sql: string) => AsyncIterable<number>
  export function bind_collection(stmt: number, params: SQLITE_TYPE[]): void
  export function step(stmt: number): Promise<number>
  export function row(stmt: number): unknown[]
  export function vfs_register(vfs: unknown, makeDefault: boolean): Promise<void>
  export function open_v2(name: string, flags: number, vfs: string): Promise<number>
  export function exec(db: number, sql: string): Promise<void>
}
declare module 'wa-sqlite/dist/wa-sqlite.mjs' {
  const factory: (opts: { locateFile: () => string }) => Promise<unknown>
  export default factory
}
declare module 'wa-sqlite/src/examples/AccessHandlePoolVFS.js' {
  export class AccessHandlePoolVFS {
    constructor(root: string)
    isReady: Promise<void>
  }
}
declare module 'wa-sqlite/dist/wa-sqlite.wasm?url' {
  const url: string
  export default url
}
