// Cálculos puros sobre totales ya agregados en Postgres. Ninguno suma
// movimientos: reciben los totales de las RPC.

/** Variación % de `current` contra `previous`, o null si `previous` es 0 */
export function percentChange(current: number, previous: number) {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

/** Variación del balance como diferencia en dinero */
export function balanceDifference(current: number, previous: number) {
  return current - previous
}

/** Balance / ingresos × 100. Puede ser negativa. null si no hay ingresos */
export function savingsRate(income: number, expense: number) {
  if (income === 0) return null
  return ((income - expense) / income) * 100
}

/** Días transcurridos (hoy incluido) y días totales del mes de `today` */
export function monthProgress(today: string) {
  const [year, month, day] = today.split("-").map(Number)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  return { daysElapsed: day, daysInMonth }
}

export function dailyAverage(expense: number, daysElapsed: number) {
  if (daysElapsed <= 0) return 0
  return expense / daysElapsed
}

/** Gasto proyectado a fin de mes al ritmo del promedio diario */
export function monthProjection(dailyAvg: number, daysInMonth: number) {
  return dailyAvg * daysInMonth
}

export interface TopWithOthers<T> {
  top: T[]
  /** Suma de las filas que no entran en el top; null si no sobra ninguna */
  others: { total: number; count: number } | null
}

// Las filas llegan ordenadas por total descendente desde category_totals
export function groupTopWithOthers<T extends { total: number }>(
  items: T[],
  limit: number
): TopWithOthers<T> {
  if (items.length <= limit) return { top: items, others: null }

  const rest = items.slice(limit)
  return {
    top: items.slice(0, limit),
    others: {
      total: rest.reduce((sum, item) => sum + item.total, 0),
      count: rest.length
    }
  }
}
