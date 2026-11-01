"use client"

import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button, cn } from "@heroui/react"
import { Ellipsis, Plus } from "lucide-react"
import { useSidebar } from "@/components/dashboard/sidebar"
import { SITE } from "@/config/site"
import { workspaceBasePath } from "@/features/workspaces/paths"
import { NAV_ICONS, type NavIcon, isActive } from "../nav"
import { useActiveWorkspace } from "../use-active-workspace"

interface Destination {
  name: string
  href: string
  icon: NavIcon
}

interface BottomNavProps {
  /** Abre la hoja de acciones rápidas */
  onOpenQuickSheet: () => void
}

const ITEM_CLASSES =
  "flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[0.6875rem] leading-tight outline-none focus-visible:ring-2 focus-visible:ring-focus"

// Barra inferior del teléfono (< 768 px): cuatro destinos del espacio, el
// botón [+] al centro y "Más", que abre el Drawer del aside. Fuera de un
// espacio (cuenta, estado vacío de Empresa) muestra los destinos de Personal
// y "Más", sin botón central. Se oculta mientras hay un diálogo abierto.
export function BottomNav({ onOpenQuickSheet }: BottomNavProps) {
  const pathname = usePathname()
  const workspace = useActiveWorkspace()
  const { setOpenMobile } = useSidebar()

  const business = workspace?.type === "business" ? workspace : undefined
  const root = business
    ? workspaceBasePath(business)
    : SITE.routes.dashboardPersonal

  const destinations: Destination[] = business
    ? SITE.navigation.mobile.business.map((segment) => {
        const item = SITE.navigation.business.find(
          (option) => option.segment === segment
        )
        return {
          name: item?.name ?? "",
          href: `${root}${segment}`,
          icon: item?.icon ?? "LayoutDashboard"
        }
      })
    : SITE.navigation.mobile.personal.map((href) => {
        const item = SITE.navigation.personal.find(
          (option) => option.href === href
        )
        return {
          name: item?.name ?? "",
          href,
          icon: item?.icon ?? "LayoutDashboard"
        }
      })

  const [first, second, third, fourth] = destinations

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-20 bg-background pb-[env(safe-area-inset-bottom)] md:hidden [body:has([role='dialog'])_&]:hidden"
    >
      <ul className="flex items-center px-2 py-1">
        {[first, second].map((item) => (
          <li
            key={item.href}
            className="flex flex-1"
          >
            <NavDestination
              item={item}
              active={isActive(pathname, item.href, root)}
            />
          </li>
        ))}
        {workspace && (
          <li className="flex flex-1 justify-center">
            <Button
              isIconOnly
              size="lg"
              aria-label="Acciones rápidas"
              className="size-12 rounded-full"
              onPress={onOpenQuickSheet}
            >
              <Plus className="size-6" />
            </Button>
          </li>
        )}
        {[third, fourth].map((item) => (
          <li
            key={item.href}
            className="flex flex-1"
          >
            <NavDestination
              item={item}
              active={isActive(pathname, item.href, root)}
            />
          </li>
        ))}
        <li className="flex flex-1">
          <button
            type="button"
            className={cn(ITEM_CLASSES, "text-muted")}
            onClick={() => setOpenMobile(true)}
          >
            <Ellipsis className="size-5" />
            Más
          </button>
        </li>
      </ul>
    </nav>
  )
}

function NavDestination({
  item,
  active
}: {
  item: Destination
  active: boolean
}) {
  const Icon = NAV_ICONS[item.icon]

  return (
    <Link
      href={item.href as Route}
      aria-current={active ? "page" : undefined}
      className={cn(
        ITEM_CLASSES,
        active ? "font-medium text-foreground" : "text-muted"
      )}
    >
      <span
        className={cn(
          "flex h-7 w-12 items-center justify-center rounded-full",
          active && "bg-accent-soft text-accent-soft-foreground"
        )}
      >
        <Icon className="size-5" />
      </span>
      {item.name}
    </Link>
  )
}
