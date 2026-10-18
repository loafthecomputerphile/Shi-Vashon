// Tile kit: square image tile, truncated caption, outfit collage, deletable
// photo thumb, headings.
import { DeleteOverlayButton } from '@/components/kit/buttons'
import { FieldLabel } from '@/components/kit/fields'
import { cn } from '@/lib/utils'

const headingCls = {
  1: 'font-heading text-3xl tracking-wide',
  2: 'font-heading text-2xl tracking-wide',
  3: 'font-heading text-xl tracking-wide',
} as const

// Which HTML tag to use for each heading level (1 -> <h1>, 2 -> <h2>, 3 -> <h3>).
const headingTag = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
} as const

export function Heading({
  level,
  className,
  children,
  ...props
}: React.ComponentProps<'h1'> & { level: 1 | 2 | 3 }) {
  // Ponytail: the tag is looked up in a plain object instead of built with a
  // template string — same result, no type cast needed.
  const Tag = headingTag[level]
  return (
    <Tag className={cn(headingCls[level], className)} {...props}>
      {children}
    </Tag>
  )
}

// Square image tile with unified selection style (outline when selected).
export function ImageTile({
  selected,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { selected?: boolean }) {
  return (
    <div
      className={cn(
        'relative aspect-square overflow-hidden border bg-muted/40 transition-colors',
        selected
          ? 'border-foreground outline-2 -outline-offset-2 outline-foreground'
          : 'border-border/60 hover:border-foreground/40',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// Truncated caption under a tile.
export function TileCaption({ className, children, ...props }: React.ComponentProps<'p'>) {
  return (
    <p className={cn('truncate text-[10px] text-muted-foreground', className)} {...props}>
      {children}
    </p>
  )
}

// Outfit collage: 2-col mini grid, first piece spans 2 when the count is odd.
export function CollageTile({
  items,
  emptyLabel,
  className,
}: {
  items: { src: string; alt: string }[]
  emptyLabel?: string
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-2 gap-px overflow-hidden border border-border/60 bg-muted/40', className)}>
      {items.length === 0 ? (
        <div className="col-span-2 flex aspect-square items-center justify-center">
          <FieldLabel>{emptyLabel}</FieldLabel>
        </div>
      ) : (
        items.map((it, i) => (
          <div
            key={`${it.src}-${i}`}
            className={cn(
              'aspect-square overflow-hidden bg-muted/40',
              items.length % 2 === 1 && i === 0 && 'col-span-2',
            )}
          >
            <img src={it.src} alt={it.alt} className="h-full w-full object-cover" loading="lazy" />
          </div>
        ))
      )}
    </div>
  )
}

// Photo thumb with the hover-reveal delete button. Size/border via className.
export function DeletableImageThumb({
  src,
  alt,
  label = 'Delete',
  onDelete,
  className,
}: {
  src: string
  alt: string
  label?: string
  onDelete: () => void
  className?: string
}) {
  return (
    <div className="group relative shrink-0">
      <img src={src} alt={alt} className={cn('object-cover', className)} />
      <DeleteOverlayButton label={label} onClick={onDelete} />
    </div>
  )
}
