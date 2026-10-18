// Layout kit: section header row, scrolling page panel.
import { Heading } from '@/components/kit/tiles'
import { cn } from '@/lib/utils'

// Title left, action right.
export function SectionHeader({
  title,
  level = 3,
  action,
  className,
}: {
  title: React.ReactNode
  level?: 1 | 2 | 3
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <Heading level={level}>{title}</Heading>
      {action}
    </div>
  )
}

// Centered scrolling tab panel (Wardrobe/Settings pages).
export function ScrollPanel({ className, children }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('mx-auto w-full max-w-5xl flex-1 overflow-y-auto p-4 pb-24 sm:p-6 max-md:pb-28', className)}>
      {children}
    </div>
  )
}
