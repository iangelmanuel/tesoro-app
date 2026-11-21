import type { MonthlyTotal } from "./queries"

// KPIs del Resumen de Personal y de Empresa (SPEC 03 y 11), a partir de
// `monthly_totals`. Esa vista rellena los meses vacíos: el último es el mes
// actual y el penúltimo, el anterior.

/** Mes actual, mes anterior y totales de la tendencia */
export function monthlyTrendSummary(monthly: MonthlyTotal[]) {
  return {
    current: monthly[monthly.length - 1],
    previous: monthly[monthly.length - 2],
    /** Ningún mes de la tendencia tiene movimientos */
    isEmptyTrend: monthly.every((row) => row.txCount === 0),
    /** Balance (o utilidad) sumado de todos los meses de la tendencia */
    trendBalance: monthly.reduce((sum, row) => sum + row.balance, 0)
  }
}

/**
 * KPIs del Resumen de Personal. Sin movimientos el mes anterior no hay
 * badge (`previous` null). El saldo acumulado al cierre del mes anterior es
 * el de hoy sin el balance de este mes.
 */
export function personalSummaryKpis(
  monthly: MonthlyTotal[],
  accumulatedBalance: number
) {
  const trend = monthlyTrendSummary(monthly)
  const previous = trend.previous.txCount > 0 ? trend.previous : null
  const previousAccumulated = accumulatedBalance - trend.current.balance

  return {
    ...trend,
    previous,
    previousAccumulated,
    /** Hay saldo o movimientos antes de este mes: el saldo acumulado compara */
    hadHistory: previousAccumulated !== 0 || previous !== null
  }
}
