// Underline text tabs (and the raw class strings for one-off tab-like buttons).
import { cn } from '@/lib/utils'

export const pillBase =
  'pb-1 text-xs uppercase tracking-[0.14em] border-b border-transparent transition-colors'
export const pillActive = 'border-foreground text-foreground'
export const pillInactive = 'text-muted-foreground hover:text-foreground'

// A row of tab buttons. Each tab has an id (e.g. 'item') and a label.
// Clicking a tab calls onChange with that tab's id.
export function UnderlineTabs({
  items,
  activeId,
  onChange,
  className,
  itemClassName,
}: {
  items: { id: string; label: React.ReactNode }[]
  activeId: string
  onChange: (id: string) => void
  className?: string
  itemClassName?: string
}) {
  return (
    <div className={cn('flex gap-4', className)}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onChange(it.id)}
          className={cn(pillBase, 'py-2 text-xs uppercase', activeId === it.id ? pillActive : pillInactive, itemClassName)}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
