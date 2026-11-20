"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { cn } from "@/libs/cn"
import { SURFACE_LIST } from "./surface"

interface ScrollTableProps {
  /** Ancho mínimo de la tabla en móvil (cualquier valor CSS). Por debajo de
   *  él la tabla se desliza en horizontal en vez de comprimir las columnas */
  minWidth?: string
  className?: string
  /** Ancla `data-tour` de los tutoriales guiados (SPEC 27) */
  tour?: string
  /** La tabla: `Table` de shadcn o, hasta SPEC 53, la de HeroUI con su
   *  `Table.ScrollContainer` */
  children: React.ReactNode
}

// El contenedor que se desliza: el de shadcn o el de HeroUI
const SCROLLER = "[data-slot=table-container], .table__scroll-container"

/**
 * Envuelve una tabla para que en móvil se lea completa y se deslice en
 * horizontal. Pinta un degradado en el borde que aún tiene contenido para
 * avisar que se puede deslizar.
 */
export function ScrollTable({
  minWidth = "40rem",
  className,
  tour,
  children
}: ScrollTableProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)

  const update = useCallback(() => {
    const scroller = rootRef.current?.querySelector<HTMLElement>(SCROLLER)
    if (!scroller) {
      return
    }
    setScrolled(scroller.scrollLeft > 1)
  }, [])

  useEffect(() => {
    const scroller = rootRef.current?.querySelector<HTMLElement>(SCROLLER)
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
      data-tour={tour}
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
          "pointer-events-none absolute inset-y-0 left-0 z-20 w-6 bg-linear-to-r from-card to-transparent transition-opacity md:hidden",
          scrolled ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  )
}

/**
 * Hueco de una tabla en su tarjeta: la misma `Table` de shadcn (cabecera de
 * 44 px y filas con el mismo relleno), con bloques en vez de texto. Las
 * columnas de monto se alinean a la derecha, como en la tabla real
 */
export function ScrollTableSkeleton({
  columns = 4,
  rows = 5,
  amountColumn = true,
  minWidth = "40rem",
  className
}: {
  columns?: number
  rows?: number
  /** La última columna es un monto (alineado a la derecha) */
  amountColumn?: boolean
  minWidth?: string
  className?: string
}) {
  const cols = Array.from({ length: columns }, (_, index) => index)
  const isAmount = (index: number) => amountColumn && index === columns - 1

  return (
    <div
      aria-hidden="true"
      style={{ "--scroll-table-min": minWidth } as React.CSSProperties}
      className={cn(
        SURFACE_LIST,
        "divide-y-0 px-2 [&_table]:max-md:min-w-(--scroll-table-min)",
        className
      )}
    >
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {cols.map((index) => (
              <TableHead key={index}>
                <Skeleton
                  className={cn("h-3 w-16", isAmount(index) && "ml-auto")}
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, row) => (
            <TableRow
              key={row}
              className="hover:bg-transparent"
            >
              {cols.map((index) => (
                <TableCell key={index}>
                  <div className="flex h-5 items-center">
                    <Skeleton
                      className={cn(
                        "h-3.5",
                        // Anchos fijos: Math.random() no se permite al
                        // prerenderizar
                        index === 1 ? "w-40" : "w-20",
                        isAmount(index) && "ml-auto w-24"
                      )}
                    />
                  </div>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
