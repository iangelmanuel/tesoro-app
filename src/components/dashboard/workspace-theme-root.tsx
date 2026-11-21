"use client"

import { Suspense, useRef } from "react"
import { usePathname } from "next/navigation"
import { PortalContainerProvider } from "@/components/ui/portal-container"
import { getWorkspaceTheme } from "@/libs/workspace-theme"

// Contenedor raíz del dashboard. Es estático: solo el marcador lee la ruta,
// dentro de su propio Suspense, porque usePathname suspende al prerenderizar
// /dashboard/business/[id] (cacheComponents). globals.css pone el primario
// del espacio en este contenedor con :has(> [data-workspace]). `contents`
// evita sumar una caja al layout.
//
// Los overlays de Base UI (PortalContainerProvider) se montan aquí y no en
// <body>, así heredan el primario del espacio
export function WorkspaceThemeRoot({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={containerRef}
      className="contents"
    >
      <Suspense fallback={null}>
        <WorkspaceThemeMarker />
      </Suspense>
      <PortalContainerProvider container={containerRef}>
        {children}
      </PortalContainerProvider>
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
    // Hidrata en su propio Suspense: si un overlay modal ya se abrió, el
    // HTML del servidor pudo quedar `inert`. Es inofensivo en un span oculto
    <span
      hidden
      data-workspace={theme}
      suppressHydrationWarning
    />
  )
}
