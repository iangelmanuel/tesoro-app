"use client"

import { Suspense, useCallback, useRef } from "react"
import { usePathname } from "next/navigation"
import { UNSAFE_PortalProvider } from "react-aria"
import { getWorkspaceTheme } from "@/libs/workspace-theme"

// Contenedor raíz del dashboard. Es estático: solo el marcador lee la ruta,
// dentro de su propio Suspense, porque usePathname suspende al prerenderizar
// /dashboard/business/[id] (cacheComponents). globals.css pone el primario
// del espacio en este contenedor con :has(> [data-workspace]). `contents`
// evita sumar una caja al layout.
//
// Los overlays de HeroUI (Drawer, Dropdown, Modal, Popover) se montan aquí y
// no en <body>, así heredan el primario del espacio
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
      <UNSAFE_PortalProvider getContainer={getContainer}>
        {children}
      </UNSAFE_PortalProvider>
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
    <span
      hidden
      data-workspace={theme}
    />
  )
}
