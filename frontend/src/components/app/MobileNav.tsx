import { cn } from '@/lib/utils'
import { TABS, type Tab } from '@/components/app/nav-shared'

// MobileNav.tsx — mobile bottom tab bar (Sidebar is desktop-only).

export default function MobileNav({ tab, onNavigate }: { tab: Tab; onNavigate: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t bg-background/95 py-2 backdrop-blur">
      {TABS.map((t) => {
        const Icon = t.icon
        return (
          <button
            key={t.id}
            onClick={() => onNavigate(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 px-1 py-2 text-sm tracking-wide transition-colors',
              tab === t.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}
