// protocol.ts — the shape of the messages that travel between the main
// thread (DBManager.ts) and the database worker (worker.ts).

// A request is one question, e.g. "getAllClothing" with no parameters.
export interface DbRequest {
  id: number // a unique number so we know which question an answer belongs to
  method: string // the name of the handler to run, e.g. 'getAllClothing'
  params: unknown[] // the arguments for that handler, as a plain list
}

// An answer to a request. `ok` says whether the handler ran fine.
// If ok is true, the answer is in `result`. If ok is false, the error
// message is in `error` (and `code` may say it was an OPFS problem).
export interface DbResponse {
  id: number // matches the id of the request this answers
  ok: boolean
  result?: unknown // present when ok is true
  error?: string // present when ok is false
  code?: 'opfs-unavailable' | 'db-error' // present when ok is false
}
