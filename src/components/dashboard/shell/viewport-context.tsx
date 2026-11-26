"use client"

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore
} from "react"
import { MOBILE_QUERY } from "@/hooks/use-is-mobile"
import { type Viewport, saveViewport } from "./viewport"

// Viewport de la cookie, leído en el servidor. Fuera del proveedor (el
// skeleton del aside) no se conoce y se montan las dos variantes
const ViewportContext = createContext<Viewport>("unknown")

function subscribe(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function getSnapshot(): Viewport {
  return window.matchMedia(MOBILE_QUERY).matches ? "mobile" : "desktop"
}

/**
 * Viewport con el que se montan las partes del shell propias de una
 * pantalla. Al hidratar usa el de la cookie, así el cliente pinta lo mismo
 * que el servidor; después sigue a la media query: girar el teléfono o
 * redimensionar monta la otra variante, que el CSS ya ubicaba
 */
export function useViewport(): Viewport {
  const initial = useContext(ViewportContext)
  return useSyncExternalStore(subscribe, getSnapshot, () => initial)
}

export function ViewportProvider({
  initial,
  children
}: Readonly<{ initial: Viewport; children: React.ReactNode }>) {
  return (
    <ViewportContext.Provider value={initial}>
      <ViewportCookieSync initial={initial} />
      {children}
    </ViewportContext.Provider>
  )
}

// Guarda el viewport real para el siguiente render del servidor. No cambia
// lo pintado: solo escribe la cookie
function ViewportCookieSync({ initial }: Readonly<{ initial: Viewport }>) {
  const viewport = useViewport()

  useEffect(() => {
    if (viewport !== "unknown" && viewport !== initial) {
      saveViewport(viewport)
    }
  }, [viewport, initial])

  return null
}
