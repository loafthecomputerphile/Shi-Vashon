// prefs.ts — small saved-in-localStorage preferences shared by more than one
// screen: the accent color (theme). Keeping this here lets Settings and
// TryOn stay lazy-loaded chunks that don't import each other.
//
// (The OpenRouter API key used to live here too — it's now held by the
// worker server-side, so nothing to store.)

// The four theme colors the user can pick. All theme styling lives in CSS.
export const ACCENTS = ['blush', 'lilac', 'sage', 'honey'] as const
export type Accent = (typeof ACCENTS)[number]

const ACCENT_KEY = 'shiah-accent'

// Saved accents are just strings in localStorage, so check the value is one
// we actually know before using it (otherwise fall back to the default).
export function loadAccent(): Accent {
  const saved = localStorage.getItem(ACCENT_KEY)
  const known = ACCENTS.find((a) => a === saved)
  return known ?? 'blush'
}

// Light theme only — apply the accent to <html>. Called on load from App and on every change.
export function applyTheme(accent: Accent) {
  document.documentElement.dataset.accent = accent
}

export function initTheme() {
  applyTheme(loadAccent())
}
