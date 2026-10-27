import { ShoppingBag, Shirt, PersonStanding, Settings as SettingsIcon, Info as InfoIcon, ShieldCheck } from 'lucide-react'
import type { OutfitSlot } from '@/types'

// nav-shared.ts — small constants shared by the app shell: the outfit slot
// order, the tab ids, and the tab list used by both nav bars.

export const SLOTS: OutfitSlot[] = ['top', 'bottom', 'hat', 'dress', 'jacket']

export type Tab = 'shop' | 'wardrobe' | 'tryon' | 'settings' | 'info' | 'admin'

export const TABS: { id: Tab; label: string; icon: typeof ShoppingBag }[] = [
  { id: 'shop', label: 'Shop', icon: ShoppingBag },
  { id: 'wardrobe', label: 'Wardrobe', icon: Shirt },
  { id: 'tryon', label: 'Try-On', icon: PersonStanding },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

// Info shows in both navs; Admin is appended only for the owner account
// (AppSidebar/MobileNav take an isAdmin prop).
export const INFO_TAB: { id: Tab; label: string; icon: typeof ShoppingBag } = {
  id: 'info', label: 'Info', icon: InfoIcon,
}

export const ADMIN_TAB: { id: Tab; label: string; icon: typeof ShoppingBag } = {
  id: 'admin', label: 'Admin', icon: ShieldCheck,
}
