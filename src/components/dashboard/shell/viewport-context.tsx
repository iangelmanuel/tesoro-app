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

// Si la pantalla cruzó el corte de 768 px desde que cargó la página
let crossedBreakpoint = false

function subscribeCrossing(onChange: () => void) {
  return subscribe(() => {
    crossedBreakpoint = true
    onChange()
  })
}

// El viewport real del navegador (en el servidor, el de la cookie)
function useMediaViewport(initial: Viewport): Viewport {
  return useSyncExternalStore(subscribe, getSnapshot, () => initial)
}

/**
 * Viewport con el que se montan las partes del shell propias de una
 * pantalla. Al hidratar usa el de la cookie, así el cliente pinta lo mismo
 * que el servidor; después sigue a la media query: girar el teléfono o
 * redimensionar monta la otra variante, que el CSS ya ubicaba. Sin cookie
 * (primera visita) se quedan las dos variantes, como antes de SPEC 57, hasta
 * que la pantalla cruce el corte: quitar la que sobra al hidratar costaba
 * más que dejarla (las acciones de cada fila de una tabla)
 */
export function useViewport(): Viewport {
  const initial = useContext(ViewportContext)
  const viewport = useMediaViewport(initial)
  const crossed = useSyncExternalStore(
    subscribeCrossing,
    () => crossedBreakpoint,
    () => false
  )
  return initial === "unknown" && !crossed ? "unknown" : viewport
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
  const viewport = useMediaViewport(initial)

  useEffect(() => {
    if (viewport !== "unknown" && viewport !== initial) {
      saveViewport(viewport)
    }
  }, [viewport, initial])

  return null
}
