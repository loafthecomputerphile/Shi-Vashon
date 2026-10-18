// Feedback kit: toast, empty states, spinner overlay, count badge, status chip.
import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Toast state + auto-dismiss. `show(msg, action?)`; action runs then dismisses.
// Ponytail: plain functions instead of useCallback — nothing depends on their
// identity, and it's one less hook to explain.
export function useToast(duration = 5000) {
  const [toast, setToast] = useState<{
    message: string
    action?: { label: string; run: () => void }
  } | null>(null)

  function show(message: string, action?: { label: string; run: () => void }) {
    setToast({ message, action })
  }

  function dismiss() {
    setToast(null)
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), duration)
    return () => clearTimeout(t)
  }, [toast, duration])

  return { toast, show, dismiss }
}

// Bottom-center toast. `light`: bordered popover chip (optionally with an
// action). `dark`: inverted chip, optional success check.
export function Toast({
  toast,
  variant = 'light',
  success,
  className,
  onAction,
}: {
  toast: { message: string; action?: { label: string; run: () => void } }
  variant?: 'light' | 'dark'
  success?: boolean
  className?: string
  onAction?: () => void
}) {
  const base = 'fixed bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-2 text-xs shadow-lg'
  const styles = {
    light: 'z-50 max-w-[calc(100%-2rem)] gap-3 border border-border bg-popover px-4 py-2 sm:bottom-6',
    dark: 'z-[60] bg-foreground px-5 py-2.5 tracking-wide text-background md:bottom-8',
  }
  return (
    <div className={cn(base, styles[variant], className)} role="status">
      {success && <Check className="size-3.5 text-[#00c853]" aria-hidden />}
      <span className={variant === 'light' ? 'truncate' : undefined}>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.run()
            onAction?.()
          }}
          className="shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-primary hover:underline"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}

// "Nothing here" states. compact: one muted line; action: line + Button;
// hero: dashed centered frame with icon + CTA (children = trigger content).
export function EmptyState({
  variant = 'compact',
  message,
  action,
  icon,
  children,
  className,
}: {
  variant?: 'compact' | 'action' | 'hero'
  message: React.ReactNode
  action?: { label: string; onClick: () => void }
  icon?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  if (variant === 'compact') {
    return <p className={cn('text-sm text-muted-foreground', className)}>{message}</p>
  }
  if (variant === 'action') {
    return (
      <div className={cn('flex flex-col items-start gap-3 p-4', className)}>
        <p className="text-sm text-muted-foreground">{message}</p>
        {action && <Button onClick={action.onClick}>{action.label}</Button>}
        {children}
      </div>
    )
  }
  return (
    <div className={cn('flex flex-col items-center gap-4 border border-dashed border-border p-14 text-center', className)}>
      <p className="text-sm text-muted-foreground">{message}</p>
      {icon}
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
      {children}
    </div>
  )
}

// Dimmed overlay with a spinner, for in-place work.
export function SpinnerOverlay({ className }: { className?: string }) {
  return (
    <div className={cn('absolute inset-0 z-10 flex items-center justify-center bg-background/60', className)}>
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  )
}

// Solid count chip — inline (pushes right) or corner-attached to a relative parent.
export function CountBadge({ count, corner }: { count: number; corner?: boolean }) {
  if (count <= 0) return null
  if (corner) {
    return (
      <span
        aria-hidden
        className="absolute -top-px -right-px flex h-4 min-w-4 items-center justify-center bg-primary text-[10px] font-medium text-primary-foreground"
      >
        {count}
      </span>
    )
  }
  return (
    <span className="ml-auto bg-primary px-1.5 text-[10px] font-medium tabular-nums text-primary-foreground">
      {count}
    </span>
  )
}

// Small dark status pill pinned bottom-left over an overlay/frame.
export function StatusChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute bottom-3 left-3 z-10 bg-foreground/85 px-3 py-1.5 text-[11px] tracking-wide text-background shadow',
        className,
      )}
    >
      {children}
    </div>
  )
}
