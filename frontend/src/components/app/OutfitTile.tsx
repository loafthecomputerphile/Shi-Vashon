import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TileCaption, CollageTile } from '@/components/kit/tiles'
import { SLOTS } from '@/components/app/nav-shared'
import SlotPicker from '@/components/app/SlotPicker'
import type { OutfitSlot, Clothing, Outfit } from '@/types'

// OutfitTile.tsx — outfit grid tile: collage of mini images (one per assigned
// item) inside one larger container. Click opens the editor dialog.

export default function OutfitTile({
  outfit,
  clothing,
  onAssign,
  onRename,
  onDelete,
  open: openProp,
  onOpenChange,
}: {
  outfit: Outfit
  clothing: Clothing[]
  onAssign: (outfitId: number, slot: OutfitSlot, clothingId: number | null) => Promise<void>
  onRename: (id: number, name: string) => Promise<void>
  onDelete: (outfit: Outfit) => Promise<void>
  // Controlled open lets "New outfit" pop the editor immediately.
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [openSelf, setOpenSelf] = useState(false)
  const isOpen = openProp ?? openSelf
  const setOpen = (v: boolean) => {
    setOpenSelf(v)
    onOpenChange?.(v)
  }
  const items = SLOTS.map((s) => outfit[s]).filter(Boolean) as Clothing[]

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group flex flex-col gap-1 text-left">
        <CollageTile items={items.map((c) => ({ src: c.path, alt: c.name }))} emptyLabel="Empty outfit" />
        <TileCaption className="text-xs">{outfit.name || 'Untitled outfit'}</TileCaption>
      </button>

      <Dialog open={isOpen} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{outfit.name ? 'Edit outfit' : 'New outfit'}</DialogTitle>
          </DialogHeader>
          <Input
            value={outfit.name}
            placeholder="Outfit name"
            onChange={(e) => onRename(outfit.id, e.target.value)}
          />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {SLOTS.map((slot) => (
              <SlotPicker
                key={slot}
                slot={slot}
                clothing={clothing}
                assigned={outfit[slot]}
                onPick={(id) => onAssign(outfit.id, slot, id)}
                onClear={() => onAssign(outfit.id, slot, null)}
              />
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {/* ponytail: Share UI hidden for now — shareOutfit in lib/shareOutfit.ts stays */}
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(outfit)
                setOpen(false)
              }}
            >
              Delete outfit
            </Button>
            {/* Every change above already wrote to the DB — Save just closes. */}
            <Button onClick={() => setOpen(false)}>Save outfit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
