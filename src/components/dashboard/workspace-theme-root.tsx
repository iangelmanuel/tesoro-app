"use client"

import { Suspense, useCallback, useRef } from "react"
import { usePathname } from "next/navigation"
import { I18nProvider, UNSAFE_PortalProvider } from "react-aria"
import { PortalContainerProvider } from "@/components/ui/portal-container"
import { SITE } from "@/config/site"
import { getWorkspaceTheme } from "@/libs/workspace-theme"

// Contenedor raíz del dashboard. Es estático: solo el marcador lee la ruta,
// dentro de su propio Suspense, porque usePathname suspende al prerenderizar
// /dashboard/business/[id] (cacheComponents). globals.css pone el primario
// del espacio en este contenedor con :has(> [data-workspace]). `contents`
// evita sumar una caja al layout.
//
// Los overlays de HeroUI (UNSAFE_PortalProvider) y los de shadcn / Base UI
// (PortalContainerProvider) se montan aquí y no en <body>, así heredan el
// primario del espacio. I18nProvider fija el
// locale de fechas y números de React Aria (DatePicker, Calendar): sin él el
// servidor y el navegador podrían usar locales distintos
export function WorkspaceThemeRoot({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const getContainer = useCallback(() => containerRef.current, [])

  return (
    <div
      ref={containerRef}
      className="contents"
    >
      <Suspense fallback={null}>
        <WorkspaceThemeMarker />
      </Suspense>
      <I18nProvider locale={SITE.seo.locale}>
        <UNSAFE_PortalProvider getContainer={getContainer}>
          <PortalContainerProvider container={containerRef}>
            {children}
          </PortalContainerProvider>
        </UNSAFE_PortalProvider>
      </I18nProvider>
    </div>
  )
}

// Se calcula en el render (también en SSR), no en un efecto, para que el
// primario no parpadee al navegar entre espacios
function WorkspaceThemeMarker() {
  const theme = getWorkspaceTheme(usePathname())

  if (!theme) {
    return null
  }

  return (
    // Hidrata en su propio Suspense: si un overlay ya se abrió, React Aria
    // le puso `inert` al HTML del servidor. Es inofensivo en un span oculto
    <span
      hidden
      data-workspace={theme}
      suppressHydrationWarning
    />
  )
}
