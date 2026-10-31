"use client"

import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Pagination } from "@heroui/react"
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

// Pagination de HeroUI: cada página navega con el router a la URL con sus
// filtros
export function TransactionsPagination({
  path = TRANSACTIONS_PATH,
  filters,
  count
}: TransactionsPaginationProps) {
  const router = useRouter()
  const totalPages = Math.ceil(count / PAGE_SIZE)

  if (totalPages <= 1) {
    return null
  }

  const goTo = (page: number) =>
    router.push(`${path}?${buildFiltersQuery(filters, { page })}` as Route)
  const current = Math.min(filters.page, totalPages)

  return (
    <Pagination className="flex-col items-center gap-2 sm:flex-row sm:justify-between">
      <Pagination.Summary>
        Página {current} de {totalPages} · {count} movimientos
      </Pagination.Summary>
      <Pagination.Content>
        {current > 1 && (
          <Pagination.Item>
            <Pagination.Previous onPress={() => goTo(current - 1)}>
              <Pagination.PreviousIcon />
              Anterior
            </Pagination.Previous>
          </Pagination.Item>
        )}
        {visiblePages(current, totalPages).map((page, index) =>
          page === "ellipsis" ? (
            <Pagination.Item key={`ellipsis-${index}`}>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ) : (
            <Pagination.Item key={page}>
              <Pagination.Link
                isActive={page === current}
                aria-current={page === current ? "page" : undefined}
                onPress={() => goTo(page)}
              >
                {page}
              </Pagination.Link>
            </Pagination.Item>
          )
        )}
        {current < totalPages && (
          <Pagination.Item>
            <Pagination.Next onPress={() => goTo(current + 1)}>
              Siguiente
              <Pagination.NextIcon />
            </Pagination.Next>
          </Pagination.Item>
        )}
      </Pagination.Content>
    </Pagination>
  )
}
