import { formatMonthYear } from "@/libs/format"
import type { TransactionFilters } from "./filters"
import type { TransactionTotals } from "./queries"

/**
 * Totales del mes anterior para el badge de las KPI de Movimientos: null si
 * no hay (todos los meses) o si ese mes no tuvo entradas ni salidas
 */
export function previousTotalsOrNull(previousTotals: TransactionTotals | null) {
  return previousTotals && (previousTotals.income || previousTotals.expense)
    ? previousTotals
    : null
}

/**
 * Alcance de la lista bajo las KPI: "Noviembre 2026", "Todos los meses" y
 * " · con filtros" si hay tipo, categoría, cuenta o búsqueda
 */
export function transactionsScope(filters: TransactionFilters) {
  const hasExtraFilters = Boolean(
    filters.type || filters.categoryId || filters.accountId || filters.q
  )
  const period =
    filters.month === "all" ? "Todos los meses" : monthTitle(filters.month)
  return `${period}${hasExtraFilters ? " · con filtros" : ""}`
}

// "Noviembre 2026": el mes con mayúscula inicial, como título
function monthTitle(month: string) {
  const label = formatMonthYear(month)
  return label.charAt(0).toUpperCase() + label.slice(1)
}
