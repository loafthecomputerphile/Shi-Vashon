// shareOutfit.ts — render an outfit's assigned items as a collage PNG and hand
// it to the Web Share API, falling back to a plain download on desktop.
import type { Outfit, OutfitSlot } from '@/types'

const SLOTS: OutfitSlot[] = ['top', 'bottom', 'hat', 'dress', 'jacket']

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// The outfit's filled slots, in order. Empty slots are skipped.
function outfitItems(outfit: Outfit) {
  const items: NonNullable<Outfit[OutfitSlot]>[] = []
  for (const slot of SLOTS) {
    const item = outfit[slot]
    if (item) items.push(item)
  }
  return items
}

async function collageBlob(outfit: Outfit): Promise<Blob | null> {
  const items = outfitItems(outfit)
  if (items.length === 0) return null
  const S = 1080
  const cols = 2
  const rows = Math.ceil(items.length / cols)
  const cell = S / cols
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = cell * rows
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  // ponytail: flat placeholder for unrenderable cells; fine while scraped
  // items are data URLs, revisit if items keep remote paths
  ctx.fillStyle = '#d4d4d4'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const imgs = await Promise.all(items.map((c) => loadImage(c.path)))
  for (const [i, img] of imgs.entries()) {
    if (!img) continue
    const x = (i % cols) * cell
    const y = Math.floor(i / cols) * cell
    // cover-crop into the cell
    const scale = Math.max(cell / img.width, cell / img.height)
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, cell, cell)
    ctx.clip()
    ctx.drawImage(img, x + (cell - img.width * scale) / 2, y + (cell - img.height * scale) / 2, img.width * scale, img.height * scale)
    ctx.restore()
  }
  return await new Promise((resolve) => {
    try {
      canvas.toBlob(resolve, 'image/png') // tainted canvas (remote images) throws here
    } catch {
      resolve(null)
    }
  })
}

export type ShareResult = 'shared' | 'downloaded' | 'none' | 'error'

export async function shareOutfit(outfit: Outfit): Promise<ShareResult> {
  const items = outfitItems(outfit)
  if (items.length === 0) return 'none'
  const name = outfit.name || 'Outfit'
  let blob: Blob | null = null
  try {
    blob = await collageBlob(outfit)
  } catch {
    blob = null
  }
  const file = blob ? new File([blob], `${name}.png`, { type: 'image/png' }) : null
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name, text: items.map((i) => i.name).join(', ') })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'shared' // user closed the share sheet
      // fall through to download
    }
  }
  if (!blob) return 'error'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.png`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}