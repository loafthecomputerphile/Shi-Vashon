// Ported from backend/src/models.py; the dead `Saved` model was intentionally not ported.

export type OutfitSlot = 'top' | 'bottom' | 'hat' | 'dress' | 'jacket'
export type ClothingType = OutfitSlot // clothing.type classifies which slot it fits

export interface Clothing {
  id: number
  name: string
  path: string // image source — data URL for scraped items, path/URL otherwise
  type: ClothingType
  brand: string
  url: string
  price: string
  added_at: string
}

export interface Outfit {
  id: number
  top: Clothing | null
  bottom: Clothing | null
  hat: Clothing | null
  dress: Clothing | null
  jacket: Clothing | null
  name: string
}

export type NewClothing = Omit<Clothing, 'id' | 'price' | 'added_at'> & { price?: string }

export type NewOutfit = {
  name: string
  top?: number | null
  bottom?: number | null
  hat?: number | null
  dress?: number | null
  jacket?: number | null
}

export interface BodyPhoto {
  id: number
  image: string // data URL
  created_at: string
}

export interface TryOnResult {
  id: number
  image: string // data URL
  ref_kind: 'item' | 'outfit'
  ref_id: number
  created_at: string
}
