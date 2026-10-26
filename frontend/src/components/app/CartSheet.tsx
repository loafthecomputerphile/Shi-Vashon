import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SectionHeader } from '@/components/kit/layout'
import { QuietAction } from '@/components/kit/buttons'
import { EmptyState } from '@/components/kit/feedback'
import type { Clothing } from '@/types'

// CartSheet.tsx — cart drawer on the shared Sheet primitive (right side,
// max-w-md).

export default function CartSheet({
  cart,
  open,
  onOpenChange,
  onRemove,
}: {
  cart: Clothing[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onRemove: (id: number) => Promise<void>
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto bg-background p-6 sm:max-w-md" showCloseButton={false}>
        <SectionHeader
          title="Cart"
          level={2}
          className="mb-4"
          action={
            <Button variant="ghost" size="icon" aria-label="Close cart" onClick={() => onOpenChange(false)}>
              <X className="size-5" />
            </Button>
          }
        />
        {cart.length === 0 ? (
          <EmptyState message="Nothing here yet — tap the bag on any product in Shop to park it for later." />
        ) : (
          <ul className="flex flex-col gap-4">
            {cart.map((item) => (
              <li key={item.id} className="flex gap-3">
                <div className="size-16 shrink-0 overflow-hidden bg-muted/50">
                  {item.path && <img src={item.path} alt={item.name} className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.brand}
                    {item.price ? ` · $${item.price}` : ''}
                  </p>
                  <div className="mt-1 flex gap-2">
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                      >
                        Buy at {item.brand || 'store'}
                      </a>
                    )}
                    <QuietAction tone="destructive" onClick={() => onRemove(item.id)}>
                      Remove
                    </QuietAction>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  )
}
