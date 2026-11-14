import { parseBudgetMonth } from "@/features/budgets/month"
import { currentMonth } from "@/libs/dates"

export interface RecurringMonth {
  /** Mes elegido (YYYY-MM) */
  month: string
  /** "octubre 2026" */
  label: string
  /** Es el mes actual en America/Bogota */
  isCurrent: boolean
  /** Mes anterior y siguiente; null en los límites */
  prev: string | null
  next: string | null
}

/**
 * `?month` de Próximos pagos. Va del mes del gasto fijo más antiguo
 * (`startMonth`) al mes actual; fuera de ese rango (o inválido) cae al
 * límite más cercano. Llamar después de leer la sesión: usa new Date().
 */
export function parseRecurringMonth(
  value: string | string[] | undefined,
  startMonth: string | null,
  now = new Date()
): RecurringMonth {
  const current = currentMonth(now)
  const first =
    startMonth !== null && startMonth < current ? startMonth : current
  const requested = parseBudgetMonth(value, now).month
  const clamped =
    requested > current ? current : requested < first ? first : requested
  const parsed = parseBudgetMonth(clamped, now)

  return {
    month: parsed.month,
    label: parsed.label,
    isCurrent: parsed.month === current,
    prev: parsed.month > first ? parsed.prev : null,
    next: parsed.month < current ? parsed.next : null
  }
}
