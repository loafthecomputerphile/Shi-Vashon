import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { useWardrobe } from '@/hooks/useWardrobe'
import { cn } from '@/lib/utils'
import { inputCls, pillBase, pillActive, pillInactive, labelCls } from '@/lib/ui'

type Wardrobe = ReturnType<typeof useWardrobe>

type Accent = (typeof ACCENTS)[number]

const ACCENTS = ['blush', 'lilac', 'sage', 'honey'] as const

const ACCENT_KEY = 'shiah-accent'
const API_KEY_STORE = 'shiah-apikey'
export { API_KEY_STORE }

// Light theme only — apply the accent to <html>. Called on load from App and on every change.
export function applyTheme(accent: Accent) {
  document.documentElement.dataset.accent = accent
}

export function initTheme() {
  const accent = ((localStorage.getItem(ACCENT_KEY) as Accent) ?? 'blush') as Accent
  applyTheme(accent)
}

export default function Settings({ wardrobe }: { wardrobe: Wardrobe }) {
  const [accent, setAccent] = useState<Accent>(loadAccent)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORE) ?? '')
  const [showKey, setShowKey] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function loadAccent(): Accent {
    return ((localStorage.getItem(ACCENT_KEY) as Accent) ?? 'blush') as Accent
  }
  function chooseAccent(next: Accent) {
    setAccent(next)
    localStorage.setItem(ACCENT_KEY, next)
    applyTheme(next)
  }
  function saveKey(value: string) {
    setApiKey(value)
    localStorage.setItem(API_KEY_STORE, value)
  }

  async function uploadPhoto(file: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    await wardrobe.addPhoto(dataUrl)
  }

  const section = 'mb-10'
  const heading = cn(labelCls, 'mb-3')

  return (
    <section className="max-w-xl">
      <h2 className="mb-8 font-heading text-3xl tracking-wide">Settings</h2>

      <div className={section}>
        <h3 className={heading}>Accent</h3>
        <div className="flex gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a}
              aria-label={`Accent: ${a}`}
              onClick={() => chooseAccent(a)}
              className={cn(
                'size-8 border border-border/60 outline-2 outline-offset-2 transition',
                accent === a ? 'outline-foreground' : 'outline-transparent hover:outline-muted-foreground/50',
              )}
              style={{ background: `var(--accent-swatch-${a})` }}
            />
          ))}
        </div>
      </div>

      <div className={section}>
        <h3 className={heading}>API key</h3>
        <p className="mb-2 text-xs text-muted-foreground">
          OpenRouter key used for Try-On generation. Stored on this device only, in plain text.
        </p>
        <div className="flex gap-2">
          <input
            className={cn(inputCls, 'flex-1')}
            type={showKey ? 'text' : 'password'}
            placeholder="sk-or-…"
            value={apiKey}
            onChange={(e) => saveKey(e.target.value)}
          />
          <Button variant="outline" size="sm" onClick={() => setShowKey((s) => !s)}>
            {showKey ? 'Hide' : 'Show'}
          </Button>
        </div>
      </div>

      <div className={section}>
        <h3 className={heading}>Body photos</h3>
        <div className="flex flex-wrap gap-3">
          {wardrobe.photos.map((p) => (
            <div key={p.id} className="group relative">
              <img src={p.image} alt="Body photo" className="h-28 w-20 border border-border object-cover" />
              <button
                aria-label="Delete photo"
                onClick={() => wardrobe.deletePhoto(p.id)}
                className="absolute top-1 right-1 bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-28 w-20 flex-col items-center justify-center gap-1 border border-dashed border-border text-xs text-muted-foreground hover:bg-muted"
          >
            <Camera className="size-5" /> Add
          </button>
        </div>
      </div>

      <div className={section}>
        <h3 className={heading}>Data</h3>
        {confirmClear ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-destructive">Delete everything — items, outfits, photos, history?</span>
            <Button variant="destructive" size="sm" onClick={async () => { await wardrobe.clearAll(); setConfirmClear(false) }}>
              Yes, delete all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setConfirmClear(true)}>
            Clear all data
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Shiah's Closet — everything lives in this browser. Nothing is uploaded anywhere except
        try-on requests to OpenRouter.
      </p>
    </section>
  )
}
