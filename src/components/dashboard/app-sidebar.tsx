"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeftRight,
  ChartColumn,
  CreditCard,
  LayoutDashboard,
  Lightbulb,
  type LucideIcon,
  PiggyBank,
  Target
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from "@/components/ui/sidebar"
import { SITE } from "@/config/site"
import { type DashboardUser, UserMenu } from "./user-menu"
import { WorkspaceTabs } from "./workspace-tabs"

type NavIcon = (typeof SITE.navigation.personal)[number]["icon"]

const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Target,
  CreditCard,
  ChartColumn,
  Lightbulb
}

function isActive(pathname: string, href: string) {
  // El Resumen es la raíz del espacio: solo se marca con coincidencia exacta
  if (href === SITE.routes.dashboardPersonal) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppSidebar({ user }: { user: DashboardUser }) {
  const pathname = usePathname()
  const isPersonal = pathname.startsWith(SITE.routes.dashboardPersonal)

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="gap-3">
        <Link
          href={SITE.routes.dashboardPersonal}
          className="px-2 pt-1 text-lg font-semibold tracking-tight"
        >
          {SITE.info.name}
        </Link>
        <WorkspaceTabs />
      </SidebarHeader>
      <SidebarContent>
        {isPersonal && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {SITE.navigation.personal.map((item) => {
                  const Icon = NAV_ICONS[item.icon]
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(pathname, item.href)}
                      >
                        <Link href={item.href}>
                          <Icon />
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <UserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
