"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@heroui/react"

// Columna de acciones fija a la derecha en móvil (`< 768 px`): fondo opaco y
// sombra a su izquierda para no superponer texto al deslizar. En escritorio
// no es fija. Se aplica al `Table.Column` y a la `Table.Cell` de acciones.
export const STICKY_ACTIONS =
  "max-md:sticky max-md:right-0 max-md:z-10 max-md:bg-surface max-md:shadow-[-10px_0_8px_-8px_rgb(0_0_0/0.35)]"

// Igual para el encabezado, cuyo fondo es `surface-secondary`: con otro color
// la celda fija se vería como un parche sobre la fila de títulos
export const STICKY_ACTIONS_HEAD = STICKY_ACTIONS.replace(
  "max-md:bg-surface",
  "max-md:bg-surface-secondary"
)

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
  // Solo el borde izquierdo: el derecho lo cubre la columna de acciones fija
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
