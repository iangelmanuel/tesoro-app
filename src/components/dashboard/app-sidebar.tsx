"use client"

import type { Route } from "next"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { ArrowUpRight, CircleHelp } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarNavLink,
  useCloseSidebarOnNavigate
} from "@/components/dashboard/sidebar"
import { ThemeToggle } from "@/components/theme/theme-toggle"
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

interface AppSidebarProps {
  user: DashboardUser
  /** Empresas del usuario, para el menú y el selector de Empresa */
  businesses: BusinessOption[]
}

export function AppSidebar({ user, businesses }: AppSidebarProps) {
  const pathname = usePathname()
  const params = useParams<{ id?: string }>()
  useCloseSidebarOnNavigate()
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
    <Sidebar>
      <SidebarHeader>
        <Link
          href={SITE.routes.dashboardPersonal}
          aria-label={`${SITE.info.name}, ir al Resumen`}
          className="flex h-9 items-center self-start rounded-xl px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Logo />
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
          <nav aria-label="Secciones del espacio">
            {/* Con una sola empresa el selector no se pinta: el nombre queda aquí */}
            {business && businesses.length < 2 && (
              <SidebarGroupLabel>
                <span className="truncate">{business.name}</span>
              </SidebarGroupLabel>
            )}
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const Icon = NAV_ICONS[item.icon]
                return (
                  <li key={item.href}>
                    <SidebarNavLink
                      href={item.href as Route}
                      isActive={isActive(pathname, item.href, root)}
                    >
                      <Icon />
                      <span className="truncate">{item.name}</span>
                    </SidebarNavLink>
                  </li>
                )
              })}
            </ul>
          </nav>
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-1">
          <a
            href={SITE.repository.issues}
            target="_blank"
            rel="noreferrer"
            className="flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 text-sm text-muted transition-colors duration-150 outline-none hover:bg-default hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
          >
            <CircleHelp className="size-4 shrink-0" />
            <span className="truncate">Ayuda</span>
            <ArrowUpRight
              aria-hidden="true"
              className="ml-auto size-3.5 shrink-0"
            />
            <span className="sr-only">(abre GitHub en otra pestaña)</span>
          </a>
          <ThemeToggle size="sm" />
        </div>
        <UserMenu user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
