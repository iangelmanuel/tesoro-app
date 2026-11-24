"use client"

import { useEffect, useState, useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { type TransactionFilters, buildFiltersQuery } from "../filters"

const SEARCH_DEBOUNCE_MS = 400

/**
 * Estado de la barra de filtros de Movimientos: navega con los filtros en la
 * URL (siempre a la página 1) y espera 400 ms de calma para buscar
 */
export function useTransactionsFilters(
  path: string,
  filters: TransactionFilters
) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState(filters.q ?? "")
  // Si la URL cambia desde fuera (p. ej. "limpiar filtros"), el texto la sigue
  const [syncedQ, setSyncedQ] = useState(filters.q)
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q)
    setQ(filters.q ?? "")
  }

  // Cualquier cambio de filtro vuelve a la página 1
  function navigate(overrides: Partial<TransactionFilters>) {
    const query = buildFiltersQuery(filters, { ...overrides, page: 1 })
    startTransition(() => {
      router.replace(`${path}?${query}` as Route, {
        scroll: false
      })
    })
  }

  useEffect(() => {
    const value = q.trim()
    if (value === (filters.q ?? "")) return

    const timeout = setTimeout(
      () => navigate({ q: value || undefined }),
      SEARCH_DEBOUNCE_MS
    )
    return () => clearTimeout(timeout)
    // navigate depende de filters, que ya está cubierto por filters.q
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filters.q])

  return { pending, q, setQ, navigate }
}
