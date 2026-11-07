import { savingsRate } from "@/features/reports/metrics"
import type { CategoryTotal, MonthlyTotal } from "@/features/reports/queries"
import type { WorkspaceType } from "@/features/workspaces/queries"
import { currentMonth, monthRange, shiftMonth } from "@/libs/dates"
import { monthSchema } from "../shared"

// Totales de un mes con los nombres de cada espacio (SPEC 34): Personal
// habla de ingresos, gastos y tasa de ahorro; Empresa de ventas, costos y
// gastos, utilidad y margen. Mismos números que Resumen y Reportes.

export const MAX_REPORT_MONTHS = 36

const round1 = (value: number) => Math.round(value * 10) / 10
const round2 = (value: number) => Math.round(value * 100) / 100

/** Margen % (utilidad / ventas), o null sin ventas */
export function margin(income: number, expense: number) {
  return income === 0 ? null : ((income - expense) / income) * 100
}

/** Totales sin el mes, para un mes o un periodo */
export function totalsFor(
  type: WorkspaceType,
  row: Omit<MonthlyTotal, "month">
) {
  if (type === "business") {
    const rate = margin(row.income, row.expense)
    return {
      sales: round2(row.income),
      costs_and_expenses: round2(row.expense),
      profit: round2(row.balance),
      margin_percent: rate === null ? null : round1(rate),
      transaction_count: row.txCount
    }
  }
  const rate = savingsRate(row.income, row.expense)
  return {
    income: round2(row.income),
    expense: round2(row.expense),
    balance: round2(row.balance),
    savings_rate_percent: rate === null ? null : round1(rate),
    transaction_count: row.txCount
  }
}

export function monthTotals(type: WorkspaceType, row: MonthlyTotal) {
  return { month: row.month.slice(0, 7), ...totalsFor(type, row) }
}

export function categoryRows(rows: CategoryTotal[], limit?: number) {
  const total = rows.reduce((sum, row) => sum + row.total, 0)
  return (limit === undefined ? rows : rows.slice(0, limit)).map((row) => ({
    category_id: row.categoryId,
    name: row.name,
    total: round2(row.total),
    share_percent: total === 0 ? 0 : round1((row.total / total) * 100),
    transaction_count: row.txCount
  }))
}

export const monthInput = monthSchema
  .optional()
  .describe("Mes YYYY-MM. Por defecto, el mes actual.")

/** Meses entre `from` y `to` (YYYY-MM), ambos incluidos */
export function monthsBetween(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number)
  const [toYear, toMonth] = to.split("-").map(Number)
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1
}

export type MonthRange =
  | { from: string; to: string; dateFrom: string; dateTo: string }
  | { error: string }

/**
 * Rango de meses validado: from ≤ to y hasta MAX_REPORT_MONTHS. Sin `from`,
 * los últimos `defaultMonths` hasta `to` (por defecto, el mes actual).
 */
export function resolveMonthRange(
  from: string | undefined,
  to: string | undefined,
  defaultMonths: number
): MonthRange {
  const end = to ?? currentMonth()
  const start = from ?? shiftMonth(end, -(defaultMonths - 1))
  const count = monthsBetween(start, end)

  if (count < 1) {
    return { error: "El mes de inicio (from) debe ser anterior o igual a to." }
  }
  if (count > MAX_REPORT_MONTHS) {
    return { error: `El periodo puede tener hasta ${MAX_REPORT_MONTHS} meses.` }
  }
  return {
    from: start,
    to: end,
    dateFrom: monthRange(start).from,
    dateTo: monthRange(end).to
  }
}
