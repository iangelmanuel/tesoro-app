"use client"

import {
  type RefObject,
  createContext,
  useContext,
  useMemo,
  useRef
} from "react"
import {
  PortalContainerProvider,
  usePortalContainer
} from "@/components/ui/portal-container"

// Puente de portales de Base UI dentro de un Modal de HeroUI, hasta SPEC 53
// (vive junto a heroui-compat.ts y se borra con él).
//
// Un Modal de HeroUI (React Aria) vuelve `inert` todo lo que queda fuera de
// él, le roba el foco y se cierra con un clic afuera. Los Popover / Combobox
// de los campos migrados (fecha, cuenta, categoría) se montan en un portal,
// fuera del modal, así que quedarían bloqueados. React Aria deja pasar los
// nodos marcados con `data-react-aria-top-layer`: no los vuelve inertes,
// permite moverles el foco y no cuenta sus clics como "afuera". El host vive
// en el contenedor del dashboard (hereda el primario del espacio) y existe
// antes de abrir cualquier modal, para que React Aria lo vea al ocultar.

const HEROUI_MODAL = "[data-slot=modal-container]"

const HostContext = createContext<RefObject<HTMLDivElement | null> | null>(null)

/** Host de los portales de Base UI abiertos dentro de un Modal de HeroUI */
export function HeroUIPortalHost({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const hostRef = useRef<HTMLDivElement>(null)

  return (
    <HostContext.Provider value={hostRef}>
      {children}
      {/* Por encima del modal de HeroUI (--z-index-overlay) y sin caja */}
      <div
        ref={hostRef}
        data-react-aria-top-layer=""
        data-slot="heroui-portal-host"
        className="absolute top-0 left-0 z-[calc(var(--z-index-overlay,100000)_+_1)] h-0 w-0"
      />
    </HostContext.Provider>
  )
}

/**
 * Envuelve un campo cuyo overlay de Base UI puede abrirse dentro de un Modal
 * de HeroUI. Fuera de un modal no cambia nada: el portal va al contenedor de
 * siempre
 */
export function HeroUIPortalBridge({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const hostRef = useContext(HostContext)
  const outer = usePortalContainer()
  const anchorRef = useRef<HTMLDivElement>(null)

  // Base UI lee `.current` al abrir el overlay; para entonces el campo ya
  // está en el DOM y se sabe si vive dentro de un modal de HeroUI
  const container = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        const inModal = anchorRef.current?.closest(HEROUI_MODAL) != null
        if (inModal && hostRef?.current) {
          return hostRef.current
        }
        return outer?.current ?? null
      }
    }),
    [hostRef, outer]
  )

  // Escape dentro del overlay lo cierra a él, no al modal: los eventos de
  // React suben por el portal hasta el Modal de HeroUI, que se cerraría
  const stopEscape = (event: React.KeyboardEvent) => {
    if (event.key !== "Escape") {
      return
    }
    const host = hostRef?.current
    const inModal = anchorRef.current?.closest(HEROUI_MODAL) != null
    if (inModal && host && host.childElementCount > 0) {
      event.stopPropagation()
    }
  }

  return (
    <div
      ref={anchorRef}
      className="contents"
      onKeyDown={stopEscape}
    >
      <PortalContainerProvider container={container}>
        {children}
      </PortalContainerProvider>
    </div>
  )
}
