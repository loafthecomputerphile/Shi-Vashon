// auth.ts — session state for the app. The session lives in an HttpOnly
// cookie set by the worker (JS can't read it, by design), so "who am I?"
// is answered by asking the worker: GET /api/me.
//
// The app (Pages) and the worker are different origins, so every call goes
// to the worker's URL (VITE_API_URL, set in Pages env vars, e.g.
// "https://sh-vashon-proxy.<account>.workers.dev") with CORS. Cookies still
// work because the worker answers with Access-Control-Allow-Credentials.

// Worker base URL. In dev the Vite proxy makes '/api' same-origin, so only
// set VITE_API_URL when the calls must cross origins (the deployed app).
const API_BASE = import.meta.env.VITE_API_URL ?? ''

export type Session = { email: string; admin: boolean }

// Asks the worker who's logged in. Returns null when logged out.
export async function loadSession(): Promise<Session | null> {
  const res = await fetch(`${API_BASE}/api/me`, { credentials: 'include' })
  if (!res.ok) return null
  const me = await res.json()
  return { email: me.email, admin: !!me.admin, used: me.used, limit: me.limit }
}

// Plain fetch with JSON + cookie defaults; throws the server's {error}
// message on failure so callers can show it directly.
export async function authFetch(path: string, body?: unknown, method = 'POST'): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: body === undefined ? 'GET' : method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Request failed.')
  return data
}

export function clearSession() {
  // The worker clears the cookie; nothing to do client-side beyond telling it.
  return authFetch('/api/logout', {})
}