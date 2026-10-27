import { useState } from 'react'
import { Camera } from 'lucide-react'
import type { Wardrobe } from '@/hooks/useWardrobe'
import type { Session } from '@/lib/auth'
import { fileToDataUrl } from '@/lib/file'
import { ACCENTS, applyTheme, loadAccent, type Accent } from '@/lib/prefs'
import { Heading } from '@/components/kit/tiles'
import { Button } from '@/components/ui/button'
import { ConfirmButton } from '@/components/kit/buttons'
import { FieldLabel, FilePickButton, SwatchPicker } from '@/components/kit/fields'
import { DeletableImageThumb } from '@/components/kit/tiles'

export default function Settings({ wardrobe, session, onLogout }: {
  wardrobe: Wardrobe
  session: Session
  onLogout: () => void
}) {
  const [accent, setAccent] = useState<Accent>(loadAccent)
  function chooseAccent(id: string) {
    // SwatchPicker hands back a plain string id; only accept known accents.
    const next = ACCENTS.find((a) => a === id)
    if (next === undefined) return
    setAccent(next)
    localStorage.setItem(ACCENT_KEY, next)
    applyTheme(next)
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
        <FieldLabel as="h3" className={heading}>Account</FieldLabel>
        <p className="mb-2 text-sm">{session.email}{session.admin && ' — owner (unlimited generations)'}</p>
        <Button variant="outline" size="sm" onClick={onLogout}>Log out</Button>
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
        Shiah's Closet — your wardrobe lives in this browser. Try-on requests are sent through the
        app's server, which holds the AI API key for you.
      </p>
    </section>
  )
}
