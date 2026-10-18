// Field kit: label, password reveal, file picker, swatch radio group.
import { useRef, useState, cloneElement } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const labelCls = 'text-[11px] uppercase tracking-[0.14em] text-muted-foreground'

// Small uppercase label; doubles as the small section heading (as="h3").
// Ponytail: the `as` prop names the HTML tag directly, so the variable can be
// used as a JSX tag with no cast — 'span' | 'h3' | 'p' | 'div' are all valid tags.
export function FieldLabel({
  as = 'span',
  className,
  children,
}: {
  as?: 'span' | 'h3' | 'p' | 'div'
  className?: string
  children?: React.ReactNode
}) {
  const Tag = as
  return <Tag className={cn(labelCls, className)}>{children}</Tag>
}

// Underline input with a Show/Hide reveal button.
export function PasswordField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className={cn('flex gap-2', className)}>
      <Input
        className="flex-1"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <Button variant="outline" onClick={() => setShow(!show)}>
        {show ? 'Hide' : 'Show'}
      </Button>
    </div>
  )
}

// Hidden file input + any trigger element (Button, dashed tile…). The trigger
// must not set its own onClick — this wires it to the picker.
export function FilePickButton({
  onFile,
  accept = 'image/*',
  trigger,
}: {
  onFile: (file: File) => void | Promise<void>
  accept?: string
  // An element with an optional onClick — cloneElement overrides it below.
  trigger: React.ReactElement<{ onClick?: () => void }>
}) {
  const ref = useRef<HTMLInputElement>(null)

  // The hidden <input type="file"> can't be styled, so it's kept invisible and
  // the trigger element's click is "forwarded" to it: cloneElement copies the
  // trigger and attaches an onClick that opens the file dialog.
  function pickFile() {
    ref.current?.click()
  }

  // When the user picks a file, hand it to onFile and reset the input so
  // picking the same file twice in a row still fires onChange.
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0) {
      await onFile(files[0])
    }
    e.target.value = ''
  }

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />
      {cloneElement(trigger, { onClick: pickFile })}
    </>
  )
}

// Row of small color squares with outline selection.
export function SwatchPicker({
  options,
  value,
  onChange,
  className,
}: {
  options: { id: string; label: string; style?: React.CSSProperties }[]
  value: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex gap-2', className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-label={o.label}
          onClick={() => onChange(o.id)}
          className={cn(
            'size-8 border border-border/60 outline-2 outline-offset-2 transition',
            value === o.id ? 'outline-foreground' : 'outline-transparent hover:outline-muted-foreground/50',
          )}
          style={o.style}
        />
      ))}
    </div>
  )
}
