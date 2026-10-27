import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Heading } from '@/components/kit/tiles'

// Info.tsx — how the app works, in plain language. Reachable from the
// login screen (before an account) and as a tab in the nav (after).

export default function Info({ onBack }: { onBack?: () => void }) {
  const section = 'mb-10'
  const h = 'mb-2'

  return (
    <section className="mx-auto max-w-xl">
      {onBack && (
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back
        </Button>
      )}
      <Heading level={1} className="mb-8">How Shiah's Closet works</Heading>

      <div className={section}>
        <Heading level={3} className={h}>1. Shop</Heading>
        <p className="text-sm text-muted-foreground">
          Browse clothing stores right inside the app. Click an item to save it to
          your wardrobe — the app grabs the picture, name, brand and price. Your
          wardrobe lives entirely in this browser; nothing is uploaded.
        </p>
      </div>

      <div className={section}>
        <Heading level={3} className={h}>2. Wardrobe</Heading>
        <p className="text-sm text-muted-foreground">
          Everything you saved, organised into tops, bottoms, dresses and more.
          Combine items into outfits, search, and filter by brand or store.
        </p>
      </div>

      <div className={section}>
        <Heading level={3} className={h}>3. Try-On</Heading>
        <p className="text-sm text-muted-foreground">
          Add a full-body photo of yourself (it stays on your device), pick one
          item or a whole outfit, and press Generate. An AI model dresses the
          person in your photo — your face, pose and background stay unchanged.
          Each account gets 4 generations per day; the counter resets at
          midnight UTC.
        </p>
      </div>

      <div className={section}>
        <Heading level={3} className={h}>Accounts</Heading>
        <p className="text-sm text-muted-foreground">
          Accounts are set up by the owner. If you don't have one yet, choose
          "Request access" on the login screen — the owner gets an email and
          will create your login.
        </p>
      </div>

      <div className={section}>
        <Heading level={3} className={h}>Privacy</Heading>
        <p className="text-sm text-muted-foreground">
          Your wardrobe, outfits and photos live only in this browser. The only
          thing that leaves your device is a try-on request: your chosen
          pictures are sent to the AI model through the app's server, which
          holds the API key for you — you never need your own.
        </p>
      </div>
    </section>
  )
}