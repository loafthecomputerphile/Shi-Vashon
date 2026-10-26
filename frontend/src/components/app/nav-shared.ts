import { ShoppingBag, Shirt, PersonStanding, Settings as SettingsIcon } from 'lucide-react'
import type { OutfitSlot } from '@/types'

// nav-shared.ts — small constants shared by the app shell: the outfit slot
// order, the tab ids, and the tab list used by both nav bars.

export const SLOTS: OutfitSlot[] = ['top', 'bottom', 'hat', 'dress', 'jacket']

export type Tab = 'shop' | 'wardrobe' | 'tryon' | 'settings'

export const TABS: { id: Tab; label: string; icon: typeof ShoppingBag }[] = [
  { id: 'shop', label: 'Shop', icon: ShoppingBag },
  { id: 'wardrobe', label: 'Wardrobe', icon: Shirt },
  { id: 'tryon', label: 'Try-On', icon: PersonStanding },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]
