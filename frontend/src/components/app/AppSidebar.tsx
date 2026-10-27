import { ShoppingBag, Scan } from 'lucide-react'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar'
import { FieldLabel } from '@/components/kit/fields'
import { CountBadge } from '@/components/kit/feedback'
import { TABS, INFO_TAB, ADMIN_TAB, type Tab } from '@/components/app/nav-shared'

// AppSidebar.tsx — desktop nav rail: shadcn Sidebar, print-shop styling
// (uppercase, square).

export default function AppSidebar({ tab, onNavigate, cartCount, onOpenCart, isAdmin }: {
  tab: Tab
  onNavigate: (t: Tab) => void
  cartCount: number
  onOpenCart: () => void
  isAdmin: boolean
}) {
  return (
    <Sidebar collapsible="none">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <span className="font-heading text-xl uppercase tracking-[0.14em]">Shiah's Closet</span>
        <FieldLabel className="mt-1 flex items-center gap-1.5">
          <Scan className="size-3" /> Personal lookbook
        </FieldLabel>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {[...TABS, INFO_TAB, ...(isAdmin ? [ADMIN_TAB] : [])].map((t) => {
                const Icon = t.icon
                return (
                  <SidebarMenuItem key={t.id}>
                    <SidebarMenuButton
                      isActive={tab === t.id}
                      onClick={() => onNavigate(t.id)}
                      className="text-xs uppercase tracking-[0.14em]"
                    >
                      <Icon className="size-4" />
                      {t.label}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onOpenCart} className="text-xs uppercase tracking-[0.14em]">
              <ShoppingBag className="size-4" />
              Cart
              <CountBadge count={cartCount} />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <span className="px-3 pb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Window shopping, on file
        </span>
      </SidebarFooter>
    </Sidebar>
  )
}
