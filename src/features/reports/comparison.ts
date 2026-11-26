import { addDays, countMonths, monthRange, shiftMonth } from "@/libs/dates"

// Periodo anterior equivalente para el badge de variación de las KPI
// (StatCard). Lógica pura: las lecturas están en `getPeriodComparison`
// (queries.ts).

/** Totales de un periodo */
export interface PeriodTotals {
  income: number
  expense: number
  balance: number
  txCount: number
}

/** Un periodo y el anterior equivalente */
export interface PeriodComparison {
  current: PeriodTotals
  /** null si no hay periodo anterior con movimientos */
  previous: PeriodTotals | null
}

const EMPTY: PeriodTotals = { income: 0, expense: 0, balance: 0, txCount: 0 }

/** Suma de los totales de varias filas (meses o categorías) */
export function sumPeriodTotals(rows: PeriodTotals[]): PeriodTotals {
  return rows.reduce(
    (total, row) => ({
      income: total.income + row.income,
      expense: total.expense + row.expense,
      balance: total.balance + row.balance,
      txCount: total.txCount + row.txCount
    }),
    EMPTY
  )
}

/** Días del rango [from, to] (YYYY-MM-DD), contando ambos extremos */
export function daysInRange(from: string, to: string) {
  const ms =
    new Date(`${to}T00:00:00Z`).getTime() -
    new Date(`${from}T00:00:00Z`).getTime()
  return Math.round(ms / 86_400_000) + 1
}

/** Cantidad de meses completos que cubre el rango, o null si no es exacto */
export function wholeMonths(from: string, to: string) {
  if (!from.endsWith("-01")) return null
  if (monthRange(to.slice(0, 7)).to !== to) return null
  return countMonths(from, to)
}

/**
 * Periodo anterior de la misma duración que [from, to]: los N meses previos
 * si son N meses completos (`months`), o los mismos días justo antes si es
 * un rango libre (`months` null)
 */
export function previousPeriod(from: string, to: string) {
  const months = wholeMonths(from, to)

  if (months !== null) {
    return {
      months,
      from: `${shiftMonth(from.slice(0, 7), -months)}-01`,
      to: addDays(from, -1)
    }
  }

  const previousTo = addDays(from, -1)
  return {
    months,
    from: addDays(previousTo, -(daysInRange(from, to) - 1)),
    to: previousTo
  }
}

/** El periodo anterior solo compara si tuvo movimientos */
export function withPrevious(
  current: PeriodTotals,
  previous: PeriodTotals
): PeriodComparison {
  return { current, previous: previous.txCount > 0 ? previous : null }
}
