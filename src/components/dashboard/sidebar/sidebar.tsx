"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react"
import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button, Drawer, cn } from "@heroui/react"
import { PanelLeft } from "lucide-react"
import { MOBILE_QUERY, useIsMobile } from "@/hooks/use-is-mobile"
import { SIDEBAR_WIDTH, clampSidebarWidth, saveSidebarWidth } from "./width"

// Sidebar del dashboard armado con primitivas de HeroUI (Button, Drawer) y
// tokens del tema. En escritorio es una columna fija que se oculta con el
// trigger o con Ctrl/⌘+B; en móvil es un panel deslizable (Drawer)

const KEYBOARD_SHORTCUT = "b"
const SIDEBAR_ID = "dashboard-sidebar"

// El atajo no debe robarle Ctrl/⌘+B a quien escribe en un campo
function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

interface SidebarContextValue {
  /** Escritorio: columna visible */
  open: boolean
  /** Móvil: panel abierto */
  openMobile: boolean
  isMobile: boolean
  setOpenMobile: (open: boolean) => void
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function useSidebar() {
  const context = useContext(SidebarContext)

  if (!context) {
    throw new Error("useSidebar debe usarse dentro de <SidebarProvider />")
  }

  return context
}

export function SidebarProvider({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const [open, setOpen] = useState(true)
  const [openMobile, setOpenMobile] = useState(false)
  const isMobile = useIsMobile()

  const toggle = useCallback(() => {
    if (window.matchMedia(MOBILE_QUERY).matches) {
      setOpenMobile((value) => !value)
    } else {
      setOpen((value) => !value)
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key === KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey) &&
        !isEditable(event.target)
      ) {
        event.preventDefault()
        toggle()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [toggle])

  return (
    <SidebarContext.Provider
      value={{ open, openMobile, isMobile, setOpenMobile, toggle }}
    >
      <div className="flex min-h-svh w-full">{children}</div>
    </SidebarContext.Provider>
  )
}

/** Al navegar, el panel móvil se cierra y queda a la vista la pantalla nueva.
 *  Va aparte de <Sidebar />: usePathname suspende al prerenderizar y el
 *  skeleton (fallback del Suspense) no puede suspender */
export function useCloseSidebarOnNavigate() {
  const { setOpenMobile } = useSidebar()
  const pathname = usePathname()

  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])
}

/** Columna en escritorio y Drawer en móvil, con el mismo contenido. `width`
 *  (px) es el ancho inicial de la columna; con `resizable` se cambia con la
 *  agarradera del borde. El Drawer mantiene su ancho */
export function Sidebar({
  width = SIDEBAR_WIDTH.default,
  resizable = false,
  children
}: Readonly<{
  width?: number
  resizable?: boolean
  children: React.ReactNode
}>) {
  const { open, openMobile, setOpenMobile } = useSidebar()
  // Cerrar la columna no toca este estado: al abrir vuelve el último ancho
  const [currentWidth, setCurrentWidth] = useState(width)
  const [isResizing, setIsResizing] = useState(false)

  return (
    <>
      <div
        data-state={open ? "expanded" : "collapsed"}
        style={
          { "--sidebar-width": `${currentWidth}px` } as React.CSSProperties
        }
        className={cn(
          "sticky top-0 hidden h-svh shrink-0 overflow-hidden bg-background transition-[width] duration-200 ease-out motion-reduce:transition-none md:block",
          open ? "w-(--sidebar-width)" : "w-0",
          // La transición queda para abrir y cerrar; al arrastrar sigue al puntero
          isResizing && "transition-none"
        )}
      >
        <aside
          id={SIDEBAR_ID}
          aria-label="Menú del dashboard"
          inert={!open}
          className="flex h-full w-(--sidebar-width) flex-col"
        >
          {children}
        </aside>
        {resizable && open && (
          <SidebarResizeHandle
            width={currentWidth}
            onWidthChange={setCurrentWidth}
            isResizing={isResizing}
            onResizingChange={setIsResizing}
          />
        )}
      </div>

      <Drawer
        isOpen={openMobile}
        onOpenChange={setOpenMobile}
      >
        <Drawer.Backdrop className="md:hidden">
          <Drawer.Content placement="left">
            <Drawer.Dialog
              aria-label="Menú del dashboard"
              className="flex w-72 flex-col p-0"
            >
              {children}
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </>
  )
}

interface SidebarResizeHandleProps {
  /** Ancho actual de la columna (px) */
  width: number
  /** La línea queda visible mientras se arrastra */
  isResizing: boolean
  onWidthChange: (width: number) => void
  /** Mientras se arrastra, la columna quita su transición de ancho */
  onResizingChange: (isResizing: boolean) => void
}

/** Agarradera del borde derecho de la columna (solo escritorio, abierta).
 *  Arrastrar cambia el ancho en vivo, doble clic lo devuelve al de por
 *  defecto; el ancho se guarda en la cookie al soltar */
export function SidebarResizeHandle({
  width,
  isResizing,
  onWidthChange,
  onResizingChange
}: SidebarResizeHandleProps) {
  const drag = useRef<{ startX: number; startWidth: number; last: number }>(
    null
  )

  function endDrag() {
    if (!drag.current) return
    const { last } = drag.current
    drag.current = null
    document.body.style.removeProperty("user-select")
    document.body.style.removeProperty("cursor")
    onResizingChange(false)
    saveSidebarWidth(last)
  }

  // Si se desmonta a mitad de arrastre (atajo para cerrar), el body no queda
  // sin selección de texto
  useEffect(
    () => () => {
      document.body.style.removeProperty("user-select")
      document.body.style.removeProperty("cursor")
    },
    []
  )

  // Teclado: cada tecla cambia el ancho y lo guarda
  function resizeTo(next: number) {
    const value = clampSidebarWidth(next)
    onWidthChange(value)
    saveSidebarWidth(value)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Cambiar el ancho del menú"
      aria-controls={SIDEBAR_ID}
      aria-valuemin={SIDEBAR_WIDTH.min}
      aria-valuemax={SIDEBAR_WIDTH.max}
      aria-valuenow={width}
      tabIndex={0}
      data-resizing={isResizing || undefined}
      // Invisible en reposo; hover y arrastre muestran una línea fina con el
      // color del foco y el foco de teclado, el anillo (3:1 en claro y oscuro)
      className="absolute inset-y-0 right-0 z-10 w-2 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:right-0 after:w-0.5 after:bg-transparent after:transition-colors after:duration-150 hover:after:bg-focus focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset data-resizing:after:bg-focus motion-reduce:after:transition-none"
      onKeyDown={(event) => {
        const { min, max, step } = SIDEBAR_WIDTH
        const next =
          event.key === "ArrowLeft"
            ? width - step
            : event.key === "ArrowRight"
              ? width + step
              : event.key === "Home"
                ? min
                : event.key === "End"
                  ? max
                  : null
        if (next === null) return
        event.preventDefault()
        resizeTo(next)
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { startX: event.clientX, startWidth: width, last: width }
        // Sin selección de texto ni hovers del contenido durante el arrastre
        document.body.style.setProperty("user-select", "none")
        document.body.style.setProperty("cursor", "col-resize")
        onResizingChange(true)
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        const next = clampSidebarWidth(
          drag.current.startWidth + event.clientX - drag.current.startX
        )
        if (next === drag.current.last) return
        drag.current.last = next
        onWidthChange(next)
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onDoubleClick={() => resizeTo(SIDEBAR_WIDTH.default)}
    />
  )
}

export function SidebarTrigger({ className }: { className?: string }) {
  const { open, openMobile, isMobile, toggle } = useSidebar()

  return (
    <Button
      variant="ghost"
      size="sm"
      isIconOnly
      aria-label="Mostrar u ocultar el menú"
      aria-expanded={isMobile ? openMobile : open}
      // El Drawer móvil se monta solo al abrirse: no hay id que referenciar
      aria-controls={isMobile ? undefined : SIDEBAR_ID}
      className={className}
      data-tour="header-menu"
      onPress={toggle}
    >
      <PanelLeft className="size-4" />
    </Button>
  )
}

export function SidebarInset({
  children
}: Readonly<{ children: React.ReactNode }>) {
  // En el teléfono ningún hijo ensancha la página: un desborde horizontal
  // desplaza el Drawer fijo respecto de la pantalla
  return (
    <div className="flex min-w-0 flex-1 flex-col max-md:overflow-x-clip">
      {children}
    </div>
  )
}

export function SidebarHeader({
  className,
  children
}: Readonly<{ className?: string; children: React.ReactNode }>) {
  return (
    <div className={cn("flex flex-col gap-4 p-3", className)}>{children}</div>
  )
}

export function SidebarContent({
  className,
  children
}: Readonly<{ className?: string; children?: React.ReactNode }>) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-auto p-3",
        className
      )}
    >
      {children}
    </div>
  )
}

export function SidebarFooter({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="flex flex-col gap-1 p-3">{children}</div>
}

export function SidebarGroupLabel({
  id,
  children
}: Readonly<{ id?: string; children: React.ReactNode }>) {
  return (
    <div
      id={id}
      className="flex h-8 items-center px-2 text-xs font-medium text-muted"
    >
      {children}
    </div>
  )
}

/** Enlace del menú. El activo va sobre --default; el primario del espacio
 *  queda para las tabs y la acción principal */
export function SidebarNavLink({
  href,
  isActive,
  children
}: Readonly<{ href: Route; isActive: boolean; children: React.ReactNode }>) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none [&>svg]:size-4 [&>svg]:shrink-0",
        isActive
          ? "bg-default font-medium text-foreground"
          : "text-muted hover:bg-default hover:text-foreground active:bg-default"
      )}
    >
      {children}
    </Link>
  )
}
