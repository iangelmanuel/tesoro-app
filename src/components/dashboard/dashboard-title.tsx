"use client"

import { usePathname } from "next/navigation"
import { SITE } from "@/config/site"
import { greeting } from "@/libs/dates"

// Rutas del dashboard que no están en la navegación de los espacios
const EXTRA_TITLES: Record<string, string> = {
  [`${SITE.routes.dashboardPersonal}/import`]: "Importar",
  [SITE.routes.account]: "Cuenta",
  [SITE.routes.dashboardBusiness]: "Empresa"
}

/** Título de la página según la ruta. La coincidencia más larga gana */
export function getDashboardTitle(pathname: string) {
  if (EXTRA_TITLES[pathname]) return EXTRA_TITLES[pathname]

  const personal = SITE.navigation.personal
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
    .sort((a, b) => b.href.length - a.href.length)[0]
  if (personal) return personal.name

  // /dashboard/business/[id]/<segment>
  const match = pathname.match(/^\/dashboard\/business\/[^/]+(\/[^/]+)?/)
  if (match) {
    const segment = match[1] ?? ""
    const item = SITE.navigation.business.find(
      (entry) => entry.segment === segment
    )
    if (item) return item.name
  }

  return SITE.info.name
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? ""
}

/**
 * Único título visible de la página, en el header del dashboard. En el
 * Resumen de Personal saluda según la hora de Bogotá; sin nombre (mientras
 * carga la sesión) muestra el título de la página
 */
export function DashboardTitle({ userName }: { userName?: string | null }) {
  const pathname = usePathname()
  const name = userName ? firstName(userName) : ""
  const title =
    pathname === SITE.routes.dashboardPersonal && name
      ? `${greeting()}, ${name}`
      : getDashboardTitle(pathname)

  return (
    <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
      {title}
    </h1>
  )
}
