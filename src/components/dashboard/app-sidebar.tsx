"use client"

import { useId } from "react"
import type { Route } from "next"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { Logo } from "@/components/brand/logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarNavLink,
  SidebarStations,
  useCloseSidebarOnNavigate
} from "@/components/dashboard/sidebar"
import { SITE } from "@/config/site"
import {
  type BusinessOption,
  BusinessSwitcher
} from "@/features/business/components/business-switcher"
import { workspaceBasePath } from "@/features/workspaces/paths"
import { NAV_ICONS, type NavIcon, isActive } from "./nav"
import { type DashboardUser, UserMenu } from "./user-menu"
import { WorkspaceTabs } from "./workspace-tabs"

interface NavItem {
  name: string
  href: string
  icon: NavIcon
}

interface NavGroup {
  label: string
  items: NavItem[]
}

interface AppSidebarProps {
  user: DashboardUser
  /** Empresas del usuario, para el menú y el selector de Empresa */
  businesses: BusinessOption[]
  /** Ancho del aside de escritorio (px), leído de la cookie en el servidor */
  width: number
}

export function AppSidebar({ user, businesses, width }: AppSidebarProps) {
  const pathname = usePathname()
  const params = useParams<{ id?: string }>()
  // Prefijo único: el aside de escritorio y el Drawer pueden convivir
  const groupId = useId()
  useCloseSidebarOnNavigate()
  // /dashboard/account mantiene el menú Personal, sin ningún ítem activo
  const isPersonal =
    pathname.startsWith(SITE.routes.dashboardPersonal) ||
    pathname === SITE.routes.account ||
    pathname.startsWith(`${SITE.routes.account}/`)
  // Solo en /dashboard/business/[id] de una empresa propia
  const business = pathname.startsWith(`${SITE.routes.dashboardBusiness}/`)
    ? businesses.find((option) => option.id === params.id)
    : undefined

  let root: string | null = null
  let groups: NavGroup[] = []
  if (isPersonal) {
    root = SITE.routes.dashboardPersonal
    groups = SITE.navigation.personal.map((group) => ({
      label: group.label,
      items: [...group.items]
    }))
  } else if (business) {
    const base = workspaceBasePath({ id: business.id, type: "business" })
    root = base
    groups = SITE.navigation.business.map((group) => ({
      label: group.label,
      items: group.items.map((item) => ({
        name: item.name,
        href: `${base}${item.segment}`,
        icon: item.icon
      }))
    }))
  }

  return (
    <Sidebar
      width={width}
      resizable
    >
      <SidebarHeader>
        <Link
          href={SITE.routes.dashboardPersonal}
          aria-label={`${SITE.info.name}, ir al Resumen`}
          className="flex h-11 items-center self-start rounded-xl px-2 outline-none focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Logo />
        </Link>
        <div
          className="w-full"
          data-tour="aside-workspaces"
        >
          <WorkspaceTabs />
        </div>
        {business && (
          <BusinessSwitcher
            businesses={businesses}
            activeId={business.id}
          />
        )}
      </SidebarHeader>
      <SidebarContent>
        {root && (
          <nav
            aria-label="Secciones del espacio"
            className="flex flex-col gap-4"
            data-tour="aside-sections"
          >
            {/* Con una sola empresa el selector no se pinta: el nombre queda aquí */}
            {business && businesses.length < 2 && (
              <SidebarGroupLabel>
                <span className="truncate">{business.name}</span>
              </SidebarGroupLabel>
            )}
            {groups.map((group, index) => {
              const labelId = `${groupId}-group-${index}`
              return (
                <div key={group.label}>
                  <SidebarGroupLabel id={labelId}>
                    <span className="truncate">{group.label}</span>
                  </SidebarGroupLabel>
                  <SidebarStations aria-labelledby={labelId}>
                    {group.items.map((item) => {
                      const Icon = NAV_ICONS[item.icon]
                      return (
                        <li key={item.href}>
                          <SidebarNavLink
                            href={item.href as Route}
                            isActive={isActive(pathname, item.href, root)}
                            marker={<Icon />}
                          >
                            <span className="truncate">{item.name}</span>
                          </SidebarNavLink>
                        </li>
                      )
                    })}
                  </SidebarStations>
                </div>
              )
            })}
          </nav>
        )}
      </SidebarContent>
      <SidebarFooter>
        <UserMenu user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
