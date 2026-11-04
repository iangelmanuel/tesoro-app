"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@heroui/react"

interface ScrollTableProps {
  /** Ancho mínimo de la tabla en móvil (cualquier valor CSS). Por debajo de
   *  él la tabla se desliza en horizontal en vez de comprimir las columnas */
  minWidth?: string
  className?: string
  /** El `<Table>` de HeroUI con su `Table.ScrollContainer` */
  children: React.ReactNode
}

/**
 * Envuelve una tabla de HeroUI para que en móvil se lea completa y se
 * deslice en horizontal. Pinta un degradado en el borde que aún tiene
 * contenido para avisar que se puede deslizar.
 */
export function ScrollTable({
  minWidth = "40rem",
  className,
  children
}: ScrollTableProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)

  const update = useCallback(() => {
    const scroller = rootRef.current?.querySelector<HTMLElement>(
      ".table__scroll-container"
    )
    if (!scroller) {
      return
    }
    setScrolled(scroller.scrollLeft > 1)
  }, [])

  useEffect(() => {
    const scroller = rootRef.current?.querySelector<HTMLElement>(
      ".table__scroll-container"
    )
    if (!scroller) {
      return
    }
    update()
    scroller.addEventListener("scroll", update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(scroller)
    const table = scroller.querySelector("table")
    if (table) {
      observer.observe(table)
    }
    return () => {
      scroller.removeEventListener("scroll", update)
      observer.disconnect()
    }
  }, [update])

  return (
    <div
      ref={rootRef}
      style={{ "--scroll-table-min": minWidth } as React.CSSProperties}
      className={cn(
        "relative [&_table]:max-md:min-w-(--scroll-table-min)",
        className
      )}
    >
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 z-20 w-6 bg-linear-to-r from-surface to-transparent transition-opacity md:hidden",
          scrolled ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  )
}
