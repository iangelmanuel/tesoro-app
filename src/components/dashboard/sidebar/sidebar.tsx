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

// Sidebar del dashboard armado con primitivas de HeroUI (Button, Drawer) y
// tokens del tema. En escritorio es una columna fija que se oculta con el
// trigger o con Ctrl/⌘+B; en móvil es un panel deslizable (Drawer)

const MOBILE_QUERY = "(max-width: 767px)"
const KEYBOARD_SHORTCUT = "b"

interface SidebarContextValue {
  /** Escritorio: columna visible */
  open: boolean
  /** Móvil: panel abierto */
  openMobile: boolean
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

  const toggle = useCallback(() => {
    if (window.matchMedia(MOBILE_QUERY).matches) {
      setOpenMobile((value) => !value)
    } else {
      setOpen((value) => !value)
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        toggle()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [toggle])

  return (
    <SidebarContext.Provider
      value={{ open, openMobile, setOpenMobile, toggle }}
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
          "sticky top-0 hidden h-svh shrink-0 overflow-hidden border-r border-separator bg-surface transition-[width,border-color] duration-200 ease-out md:block",
          open ? "w-64" : "w-0 border-transparent"
        )}
      >
        <aside
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
  const { toggle } = useSidebar()

  return (
    <Button
      variant="ghost"
      size="sm"
      isIconOnly
      aria-label="Mostrar u ocultar el menú"
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
    <div className={cn("flex flex-col gap-3 p-3", className)}>{children}</div>
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
  return (
    <div className="flex flex-col gap-2 border-t border-separator p-3">
      {children}
    </div>
  )
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

/** Enlace del menú. El activo usa el primario del espacio (--accent) */
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
        "flex h-9 items-center gap-2 rounded-lg px-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus [&>svg]:size-4 [&>svg]:shrink-0",
        isActive
          ? "bg-accent-soft font-medium text-accent-soft-foreground"
          : "text-foreground hover:bg-default"
      )}
    >
      {children}
    </Link>
  )
}
