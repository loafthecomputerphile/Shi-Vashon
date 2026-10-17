// Search input + filter popover — the Wardrobe's clothing filter bar, shared
// with Try-On so the two stay identical.
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { NO_FILTERS, toggleIn, type Filters } from '@/lib/filters'

export function ClothingFilterBar({
  query,
  onQuery,
  filters,
  onFilters,
  types,
  brands,
  markets,
  showFilters = true,
}: {
  query: string
  onQuery: (q: string) => void
  filters: Filters
  onFilters: (f: Filters) => void
  types: string[]
  brands: string[]
  markets: string[]
  showFilters?: boolean
}) {
  const activeCount = filters.types.size + filters.brands.size + filters.markets.size
  const toggle = (key: 'types' | 'brands' | 'markets', v: string) =>
    onFilters({ ...filters, [key]: toggleIn(filters[key], v) })

  return (
    <div className="flex items-center gap-2">
      <Input placeholder="Search by name" value={query} onChange={(e) => onQuery(e.target.value)} />
      {showFilters && (
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" className="shrink-0">
                Filters{activeCount > 0 ? ` (${activeCount})` : ''}
                <ChevronDown className="opacity-50" />
              </Button>
            }
          />
          <PopoverContent className="w-64 p-0" align="end">
            <Command>
              <CommandInput placeholder="Filter options…" />
              <CommandList>
                <CommandEmpty>No options.</CommandEmpty>
                <CommandGroup heading="Type">
                  {types.map((v) => (
                    <CommandItem
                      key={v}
                      data-checked={filters.types.has(v)}
                      onSelect={() => toggle('types', v)}
                    >
                      {v}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {brands.length > 0 && (
                  <CommandGroup heading="Brand">
                    {brands.map((v) => (
                      <CommandItem
                        key={v}
                        data-checked={filters.brands.has(v)}
                        onSelect={() => toggle('brands', v)}
                      >
                        {v}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {markets.length > 0 && (
                  <CommandGroup heading="Marketplace">
                    {markets.map((v) => (
                      <CommandItem
                        key={v}
                        data-checked={filters.markets.has(v)}
                        onSelect={() => toggle('markets', v)}
                      >
                        {v}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
            {activeCount > 0 && (
              <button
                type="button"
                className="border-t border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => onFilters(NO_FILTERS)}
              >
                Clear filters
              </button>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}