// App-agnostic button kit: bare icon buttons, hover-reveal delete, quiet text
// actions, loading state, two-step destructive confirm.
import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Bare <button> carrying just an icon — for placements the shadcn Button is
// too heavy for (inline X, header back, corner cart).
const iconSizes = { xs: 'p-1', sm: 'p-1.5', md: 'p-2' }
const iconTones = {
  ghost: 'text-muted-foreground hover:text-foreground',
  fill: 'hover:bg-muted',
}
export function IconButton({
  size = 'xs',
  tone = 'ghost',
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & {
  size?: keyof typeof iconSizes
  tone?: keyof typeof iconTones
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-colors',
        iconSizes[size],
        iconTones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// Trash button revealed on group hover — sits over an image thumb.
export function DeleteOverlayButton({
  label = 'Delete',
  onClick,
  className,
}: {
  label?: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'absolute top-1 right-1 z-10 bg-background/80 p-1 opacity-60 transition-opacity group-hover:opacity-100 max-lg:opacity-100',
        className,
      )}
    >
      <Trash2 className="size-3.5" />
    </button>
  )
}

// Text-link action: quiet "Remove", uppercase toast action, etc.
const quietTones = {
  muted: 'text-muted-foreground hover:text-foreground',
  destructive: 'text-muted-foreground hover:text-destructive',
  primary: 'font-medium text-primary underline-offset-2 hover:underline',
  primaryCaps: 'font-medium uppercase tracking-[0.14em] text-primary hover:underline',
}
export function QuietAction({
  tone = 'muted',
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & { tone?: keyof typeof quietTones }) {
  return (
    <button
      type="button"
      className={cn('text-xs transition-colors', quietTones[tone], className)}
      {...props}
    >
      {children}
    </button>
  )
}

// Button that shows a spinner + busy label while working.
export function LoadingButton({
  busy,
  busyLabel,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { busy?: boolean; busyLabel?: string }) {
  return (
    <Button {...props} disabled={props.disabled || busy}>
      {busy ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {busyLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  )
}

// Two-step destructive confirm: trigger swaps to warning text + Yes/Cancel.
export function ConfirmButton({
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  buttonProps,
  className,
  children,
}: {
  message: string
  confirmLabel?: string
  onConfirm: () => void | Promise<void>
  buttonProps?: React.ComponentProps<typeof Button>
  className?: string
  children: React.ReactNode
}) {
  const [armed, setArmed] = useState(false)
  if (!armed) {
    return (
      <Button {...buttonProps} onClick={() => setArmed(true)}>
        {children}
      </Button>
    )
  }
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-sm text-destructive">{message}</span>
      <Button
        variant="destructive"
        size="sm"
        onClick={async () => {
          setArmed(false)
          await onConfirm()
        }}
      >
        {confirmLabel}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </div>
  )
}
