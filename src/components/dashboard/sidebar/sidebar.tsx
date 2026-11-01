"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from "react"
import type { Route } from "next"
import Link from "next/link"
import { Button, Drawer, cn } from "@heroui/react"
import { PanelLeft } from "lucide-react"
import { MOBILE_QUERY, useIsMobile } from "@/hooks/use-is-mobile"

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

/** Columna en escritorio y Drawer en móvil, con el mismo contenido */
export function Sidebar({ children }: Readonly<{ children: React.ReactNode }>) {
  const { open, openMobile, setOpenMobile } = useSidebar()

  return (
    <>
      <div
        data-state={open ? "expanded" : "collapsed"}
        className={cn(
          "sticky top-0 hidden h-svh shrink-0 overflow-hidden bg-background transition-[width] duration-200 ease-out motion-reduce:transition-none md:block",
          open ? "w-64" : "w-0"
        )}
      >
        <aside
          id={SIDEBAR_ID}
          aria-label="Menú del dashboard"
          inert={!open}
          className="flex h-full w-64 flex-col"
        >
          {children}
        </aside>
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
      onPress={toggle}
    >
      <PanelLeft className="size-4" />
    </Button>
  )
}

export function SidebarInset({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="flex min-w-0 flex-1 flex-col">{children}</div>
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
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-8 items-center px-2 text-xs font-medium text-muted">
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
