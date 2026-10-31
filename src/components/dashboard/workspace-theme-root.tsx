"use client"

import { Suspense } from "react"
import { usePathname } from "next/navigation"
import { getWorkspaceTheme } from "@/libs/workspace-theme"

// Contenedor raíz del dashboard. Es estático: solo el marcador lee la ruta,
// dentro de su propio Suspense, porque usePathname suspende al prerenderizar
// /dashboard/business/[id] (cacheComponents). globals.css pone el primario
// del espacio en este contenedor con :has(> [data-workspace]). `contents`
// evita sumar una caja al layout
export function WorkspaceThemeRoot({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="contents">
      <Suspense fallback={null}>
        <WorkspaceThemeMarker />
      </Suspense>
      {children}
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
