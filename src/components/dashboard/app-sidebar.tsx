"use client"

import type { Route } from "next"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import {
  Activity,
  ArrowLeftRight,
  ChartColumn,
  CreditCard,
  LayoutDashboard,
  Lightbulb,
  type LucideIcon,
  PiggyBank,
  Settings,
  Target,
  Wallet
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from "@/components/ui/sidebar"
import { SITE } from "@/config/site"
import {
  type BusinessOption,
  BusinessSwitcher
} from "@/features/business/components/business-switcher"
import { workspaceBasePath } from "@/features/workspaces/paths"
import { type DashboardUser, UserMenu } from "./user-menu"
import { WorkspaceTabs } from "./workspace-tabs"

type NavIcon =
  | (typeof SITE.navigation.personal)[number]["icon"]
  | (typeof SITE.navigation.business)[number]["icon"]

const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  PiggyBank,
  Target,
  CreditCard,
  ChartColumn,
  Lightbulb,
  Activity,
  Settings
}

interface NavItem {
  name: string
  href: string
  icon: NavIcon
}

// El Resumen es la raíz del espacio: solo se marca con coincidencia exacta
function isActive(pathname: string, href: string, root: string) {
  if (href === root) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

interface AppSidebarProps {
  user: DashboardUser
  /** Empresas del usuario, para el menú y el selector de Empresa */
  businesses: BusinessOption[]
}

export function AppSidebar({ user, businesses }: AppSidebarProps) {
  const pathname = usePathname()
  const params = useParams<{ id?: string }>()
  // /dashboard/account mantiene el menú Personal, sin ningún ítem activo
  const isPersonal =
    pathname.startsWith(SITE.routes.dashboardPersonal) ||
    pathname === SITE.routes.account
  // Solo en /dashboard/business/[id] de una empresa propia
  const business = pathname.startsWith(`${SITE.routes.dashboardBusiness}/`)
    ? businesses.find((option) => option.id === params.id)
    : undefined

  let root: string | null = null
  let items: NavItem[] = []
  if (isPersonal) {
    root = SITE.routes.dashboardPersonal
    items = [...SITE.navigation.personal]
  } else if (business) {
    const base = workspaceBasePath({ id: business.id, type: "business" })
    root = base
    items = SITE.navigation.business.map((item) => ({
      name: item.name,
      href: `${base}${item.segment}`,
      icon: item.icon
    }))
  }

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
        {business && (
          <BusinessSwitcher
            businesses={businesses}
            activeId={business.id}
          />
        )}
      </SidebarHeader>
      <SidebarContent>
        {root && (
          <SidebarGroup>
            {/* Con una sola empresa el selector no se pinta: el nombre queda aquí */}
            {business && businesses.length < 2 && (
              <SidebarGroupLabel>
                <span className="truncate">{business.name}</span>
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const Icon = NAV_ICONS[item.icon]
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(pathname, item.href, root)}
                      >
                        <Link href={item.href as Route}>
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
