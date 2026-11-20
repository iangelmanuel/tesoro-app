import type { Route } from "next"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/libs/cn"
import {
  PAGE_SIZE,
  TRANSACTIONS_PATH,
  type TransactionFilters,
  buildFiltersQuery
} from "../filters"

// Páginas visibles: la primera, la última y dos a cada lado de la actual
function visiblePages(current: number, total: number) {
  const pages: (number | "ellipsis")[] = []

  for (let page = 1; page <= total; page++) {
    if (page === 1 || page === total || Math.abs(page - current) <= 2) {
      pages.push(page)
    } else if (pages.at(-1) !== "ellipsis") {
      pages.push("ellipsis")
    }
  }
  return pages
}

interface TransactionsPaginationProps {
  /** Ruta de Movimientos del espacio */
  path?: string
  filters: TransactionFilters
  count: number
}

// Cada página es un enlace a la URL con sus filtros: se puede abrir en otra
// pestaña y el lector la anuncia como navegación
export function TransactionsPagination({
  path = TRANSACTIONS_PATH,
  filters,
  count
}: TransactionsPaginationProps) {
  const totalPages = Math.ceil(count / PAGE_SIZE)

  if (totalPages <= 1) {
    return null
  }

  const href = (page: number) =>
    `${path}?${buildFiltersQuery(filters, { page })}` as Route
  const current = Math.min(filters.page, totalPages)

  return (
    <nav
      aria-label="Páginas de movimientos"
      className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between"
    >
      <p className="text-sm text-muted-foreground tabular-nums">
        Página {current} de {totalPages} · {count} movimientos
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-1">
        {current > 1 && (
          <li>
            <Link
              href={href(current - 1)}
              className={buttonVariants({ variant: "ghost" })}
            >
              <ChevronLeft aria-hidden />
              Anterior
            </Link>
          </li>
        )}
        {visiblePages(current, totalPages).map((page, index) =>
          page === "ellipsis" ? (
            <li
              key={`ellipsis-${index}`}
              aria-hidden="true"
              className="flex size-11 items-center justify-center text-muted-foreground"
            >
              …
            </li>
          ) : (
            <li key={page}>
              <Link
                href={href(page)}
                aria-current={page === current ? "page" : undefined}
                aria-label={`Página ${page}`}
                className={cn(
                  buttonVariants({
                    variant: page === current ? "secondary" : "ghost",
                    size: "icon"
                  }),
                  "tabular-nums",
                  page === current && "font-semibold"
                )}
              >
                {page}
              </Link>
            </li>
          )
        )}
        {current < totalPages && (
          <li>
            <Link
              href={href(current + 1)}
              className={buttonVariants({ variant: "ghost" })}
            >
              Siguiente
              <ChevronRight aria-hidden />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  )
}
