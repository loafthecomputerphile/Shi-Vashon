// dupe.ts — pure matching for the save path's dupe check. Kept separate from
// save.ts (which pulls in catalog/fetch/JSON configs) so node can test it.

export interface DupeCandidate {
  url: string | null
  name: string
  brand: string
}

// A scraped product is a dupe of an existing item when the product URL matches,
// or the normalized name AND brand match (same "Elsie Sweater" from a different
// store is not a dupe). Empty names never match by name.
export function findDupe<T extends DupeCandidate>(
  clothing: T[],
  p: { url?: string | null; name?: string | null; brand?: string | null },
): T | undefined {
  const norm = (s: string) => s.trim().toLowerCase()
  const name = norm(p.name ?? '')
  return clothing.find(
    (c) =>
      (p.url && c.url && c.url === p.url) ||
      (name !== '' && norm(c.name) === name && c.brand === (p.brand ?? '')),
  )
}