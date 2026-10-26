// prefs.ts — small saved-in-localStorage preferences shared by more than one
// screen: the accent color (theme) and the OpenRouter API key. Keeping these
// here lets Settings and TryOn stay lazy-loaded chunks that don't import
// each other.

// The four theme colors the user can pick. All theme styling lives in CSS.
export const ACCENTS = ['blush', 'lilac', 'sage', 'honey'] as const
export type Accent = (typeof ACCENTS)[number]

const ACCENT_KEY = 'shiah-accent'
export const API_KEY_STORE = 'shiah-apikey'

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
