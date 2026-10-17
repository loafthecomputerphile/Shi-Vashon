// Shared wardrobe filtering: name search + type/brand/marketplace pills.
// Used by the Wardrobe tab, the outfit slot picker and the Try-On picker.
import type { Clothing } from '@/types'
import { cn } from '@/lib/utils'
import { pillBase, pillActive, pillInactive, labelCls } from '@/lib/ui'

// The item's product-URL host — "birkenstock.com" etc. Empty for manual items.
export function marketplaceOf(c: Clothing): string {
  try {
    return new URL(c.url).host
  } catch {
    return ''
  }
}

export interface Filters {
  types: Set<string>
  brands: Set<string>
  markets: Set<string>
}

export const NO_FILTERS: Filters = { types: new Set(), brands: new Set(), markets: new Set() }

export function toggleIn(set: Set<string>, v: string): Set<string> {
  const next = new Set(set)
  if (next.has(v)) next.delete(v)
  else next.add(v)
  return next
}

// Search is name-only; the filter pills cover type/brand/marketplace.
export function matchesQuery(c: Clothing, q: string, filters: Filters): boolean {
  const needle = q.trim().toLowerCase()
  if (needle && !c.name.toLowerCase().includes(needle)) return false
  if (filters.types.size > 0 && !filters.types.has(c.type)) return false
  if (filters.brands.size > 0 && !filters.brands.has(c.brand)) return false
  if (filters.markets.size > 0 && !filters.markets.has(marketplaceOf(c))) return false
  return true
}

// One filter pill row, shared by the picker panels.
export function FilterPillRow({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string
  values: string[]
  selected: Set<string>
  onToggle: (v: string) => void
}) {
  if (values.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className={labelCls}>{label}</span>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onToggle(v)}
          className={cn(pillBase, 'py-1 uppercase', selected.has(v) ? pillActive : pillInactive)}
        >
          {v}
        </button>
      ))}
    </div>
  )
}