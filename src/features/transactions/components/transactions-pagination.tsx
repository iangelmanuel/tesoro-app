import type { Route } from "next"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination"
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
    <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Página {current} de {totalPages} · {count} movimientos
      </p>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          {current > 1 && (
            <PaginationItem>
              <PaginationPrevious href={href(current - 1)} />
            </PaginationItem>
          )}
          {visiblePages(current, totalPages).map((page, index) =>
            page === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink
                  href={href(page)}
                  isActive={page === current}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            )
          )}
          {current < totalPages && (
            <PaginationItem>
              <PaginationNext href={href(current + 1)} />
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>
    </div>
  )
}
