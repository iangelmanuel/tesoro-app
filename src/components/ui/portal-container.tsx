"use client"

import { type RefObject, createContext, useContext } from "react"

// Dónde montan sus portales los overlays (diálogos, menús, popovers…). Por
// defecto Base UI los pone en <body>, fuera del contenedor del dashboard, y
// ahí perderían el primario del espacio (data-workspace + :has() en
// globals.css). WorkspaceThemeRoot provee su contenedor; fuera del dashboard
// no hay proveedor y los portales van a <body>
const PortalContainerContext =
  createContext<RefObject<HTMLElement | null> | null>(null)

function PortalContainerProvider({
  container,
  children
}: Readonly<{
  container: RefObject<HTMLElement | null>
  children: React.ReactNode
}>) {
  return (
    <PortalContainerContext.Provider value={container}>
      {children}
    </PortalContainerContext.Provider>
  )
}

function usePortalContainer() {
  return useContext(PortalContainerContext) ?? undefined
}

export { PortalContainerProvider, usePortalContainer }
