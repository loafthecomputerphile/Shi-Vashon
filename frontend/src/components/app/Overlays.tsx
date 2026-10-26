import CartSheet from '@/components/app/CartSheet'
import { Toast } from '@/components/kit/feedback'
import type { Clothing } from '@/types'

// Overlays.tsx — everything that floats above the app content: the cart
// drawer and the toast popup. App() renders this one component instead of
// handling both inline.
//
// Note: Minibrowser renders its own dark-variant Toast separately — this file
// is only for the main app shell.

export default function Overlays({
  cart,
  cartOpen,
  setCartOpen,
  onRemoveFromCart,
  toast,
  dismissToast,
}: {
  cart: Clothing[]
  cartOpen: boolean
  setCartOpen: (open: boolean) => void
  onRemoveFromCart: (id: number) => Promise<void>
  toast: { message: string; action?: { label: string; run: () => void } } | null
  dismissToast: () => void
}) {
  return (
    <>
      {toast && <Toast toast={toast} onAction={dismissToast} />}
      <CartSheet cart={cart} open={cartOpen} onOpenChange={setCartOpen} onRemove={onRemoveFromCart} />
    </>
  )
}
