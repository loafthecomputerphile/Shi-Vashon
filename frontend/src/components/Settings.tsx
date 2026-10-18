import { useState } from 'react'
import { Camera } from 'lucide-react'
import type { Wardrobe } from '@/hooks/useWardrobe'
import { fileToDataUrl } from '@/lib/file'
import { Heading } from '@/components/kit/tiles'
import { ConfirmButton } from '@/components/kit/buttons'
import { FieldLabel, PasswordField, FilePickButton, SwatchPicker } from '@/components/kit/fields'
import { DeletableImageThumb } from '@/components/kit/tiles'

// The four theme colors the user can pick. All theme styling lives in CSS.
const ACCENTS = ['blush', 'lilac', 'sage', 'honey'] as const
type Accent = (typeof ACCENTS)[number]

const ACCENT_KEY = 'shiah-accent'
const API_KEY_STORE = 'shiah-apikey'
export { API_KEY_STORE }

// Saved accents are just strings in localStorage, so check the value is one
// we actually know before using it (otherwise fall back to the default).
function loadAccent(): Accent {
  const saved = localStorage.getItem(ACCENT_KEY)
  const known = ACCENTS.find((a) => a === saved)
  return known ?? 'blush'
}

// Light theme only — apply the accent to <html>. Called on load from App and on every change.
export function applyTheme(accent: Accent) {
  document.documentElement.dataset.accent = accent
}

export function initTheme() {
  applyTheme(loadAccent())
}

export default function Settings({ wardrobe }: { wardrobe: Wardrobe }) {
  const [accent, setAccent] = useState<Accent>(loadAccent)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORE) ?? '')
  function chooseAccent(id: string) {
    // SwatchPicker hands back a plain string id; only accept known accents.
    const next = ACCENTS.find((a) => a === id)
    if (next === undefined) return
    setAccent(next)
    localStorage.setItem(ACCENT_KEY, next)
    applyTheme(next)
  }
  function saveKey(value: string) {
    setApiKey(value)
    localStorage.setItem(API_KEY_STORE, value)
  }

  async function uploadPhoto(file: File) {
    await wardrobe.addPhoto(await fileToDataUrl(file))
  }

  const section = 'mb-10'
  const heading = 'mb-3'

  return (
    <section className="max-w-xl">
      <Heading level={1} className="mb-8">Settings</Heading>

      <div className={section}>
        <FieldLabel as="h3" className={heading}>Accent</FieldLabel>
        <SwatchPicker
          options={ACCENTS.map((a) => ({
            id: a,
            label: `Accent: ${a}`,
            style: { background: `var(--accent-swatch-${a})` },
          }))}
          value={accent}
          onChange={chooseAccent}
        />
      </div>

      <div className={section}>
        <FieldLabel as="h3" className={heading}>API key</FieldLabel>
        <p className="mb-2 text-xs text-muted-foreground">
          OpenRouter key used for Try-On generation. Stored on this device only, in plain text.
        </p>
        <PasswordField
          value={apiKey}
          onChange={saveKey}
          placeholder="sk-or-…"
        />
      </div>

      <div className={section}>
        <FieldLabel as="h3" className={heading}>Body photos</FieldLabel>
        <div className="flex flex-wrap gap-3">
          {wardrobe.photos.map((p) => (
            <DeletableImageThumb
              key={p.id}
              src={p.image}
              alt="Body photo"
              label="Delete photo"
              className="h-28 w-20 border border-border"
              onDelete={() => wardrobe.deletePhoto(p.id)}
            />
          ))}
          <FilePickButton
            onFile={uploadPhoto}
            trigger={
              <button className="flex h-28 w-20 flex-col items-center justify-center gap-1 border border-dashed border-border text-xs text-muted-foreground hover:bg-muted">
                <Camera className="size-5" /> Add
              </button>
            }
          />
        </div>
      </div>

      <div className={section}>
        <FieldLabel as="h3" className={heading}>Data</FieldLabel>
        <ConfirmButton
          message="Delete everything — items, outfits, photos, history?"
          confirmLabel="Yes, delete all"
          onConfirm={async () => {
            await wardrobe.clearAll()
          }}
          buttonProps={{ variant: 'outline', size: 'sm' }}
        >
          Clear all data
        </ConfirmButton>
      </div>

      <p className="text-xs text-muted-foreground">
        Shiah's Closet — everything lives in this browser. Nothing is uploaded anywhere except
        try-on requests to OpenRouter.
      </p>
    </section>
  )
}
