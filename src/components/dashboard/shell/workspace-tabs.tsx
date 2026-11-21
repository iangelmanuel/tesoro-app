"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { SITE } from "@/config/site"
import { cn } from "@/libs/cn"

export const WORKSPACE_TABS = [
  { id: "personal", label: "Personal", href: SITE.routes.dashboardPersonal },
  { id: "business", label: "Empresa", href: SITE.routes.dashboardBusiness }
] as const

// Pestaña activa según la ruta: Empresa bajo /dashboard/business, Personal en
// el resto (incluida /dashboard/account)
export function getActiveWorkspaceTab(pathname: string) {
  return pathname.startsWith(SITE.routes.dashboardBusiness)
    ? "business"
    : "personal"
}

// Selector Personal / Empresa. Son enlaces, no pestañas (cada uno lleva a su
// espacio): una navegación con el actual marcado con aria-current. Misma
// píldora que TabsList; el activo va en negrita sobre su propio fondo
export function WorkspaceTabs() {
  const pathname = usePathname()
  const active = getActiveWorkspaceTab(pathname)

  return (
    <nav
      aria-label="Espacio"
      className="flex h-11 w-full items-center rounded-4xl bg-subtle p-1 dark:bg-card"
    >
      {WORKSPACE_TABS.map((tab) => {
        const isActive = tab.id === active
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "touch-hitbox flex h-full flex-1 items-center justify-center rounded-4xl px-4 text-sm transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              isActive
                ? "bg-card font-semibold text-foreground shadow-(--surface-shadow) dark:bg-highlight"
                : "font-medium text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
