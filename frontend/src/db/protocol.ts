export interface DbRequest {
  id: number
  method: string
  params: unknown[]
}

export type DbResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string; code?: 'opfs-unavailable' | 'db-error' }
