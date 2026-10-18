// dupe.ts — pure matching for the save path's dupe check. Kept separate from
// save.ts (which pulls in catalog/fetch/JSON configs) so node can test it.

// The small slice of a clothing item that the dupe check looks at.
export interface DupeCandidate {
  id: number
  url: string | null
  name: string
  brand: string
}

// A scraped product is a dupe of an existing item when the product URL matches,
// or the normalized name AND brand match (same "Elsie Sweater" from a different
// store is not a dupe). Empty names never match by name.
export function findDupe(
  clothing: DupeCandidate[],
  p: { url?: string | null; name?: string | null; brand?: string | null },
): DupeCandidate | undefined {
  const norm = (s: string) => s.trim().toLowerCase()
  const name = norm(p.name ?? '')
  for (const item of clothing) {
    const sameUrl = p.url !== null && p.url !== undefined && item.url !== null && item.url === p.url
    const sameName = name !== '' && norm(item.name) === name && item.brand === (p.brand ?? '')
    if (sameUrl || sameName) return item
  }
  return undefined
}
