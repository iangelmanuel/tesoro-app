import { formatMonthYear } from "@/features/debts/calculations"
import { monthRange } from "@/libs/dates"
import type { UpcomingPayment } from "./queries"

// Lógica del historial de un gasto fijo en su Sheet (SPEC 37 y 49). La lista
// va del periodo más reciente al más antiguo y llega hasta el mes actual. Sin
// server-only: el Sheet (cliente) lo importa.

/** Periodos visibles del historial antes de "Ver más" */
export const HISTORY_PAGE_SIZE = 12

/** "octubre de 2026" en los mensuales o "2026" en los anuales */
export function periodLabel(
  payment: Pick<UpcomingPayment, "dueOn">,
  isYearly: boolean
) {
  return isYearly
    ? payment.dueOn.slice(0, 4)
    : formatMonthYear(payment.dueOn.slice(0, 7))
}

/** El periodo por pagar más antiguo: los atrasados primero */
export function nextUnpaidPayment<
  T extends Pick<UpcomingPayment, "transactionId">
>(payments: T[]) {
  return payments.findLast((payment) => payment.transactionId === null) ?? null
}

/**
 * ¿Quedan ocurrencias después de `month` (YYYY-MM)? Sin fin, o con fin
 * después de ese mes, sí: el historial solo llega al mes actual
 */
export function hasFutureOccurrences(
  expense: { ends_on: string | null },
  month: string
) {
  return expense.ends_on === null || expense.ends_on > monthRange(month).to
}

/**
 * Duplicar paga la siguiente ocurrencia sin pagar (SPEC 49): se puede si
 * quedan ocurrencias futuras o alguna sin pagar después de `payment`
 */
export function canDuplicatePayment(
  payments: Pick<UpcomingPayment, "transactionId" | "dueOn">[],
  payment: Pick<UpcomingPayment, "dueOn">,
  hasFuture: boolean
) {
  return (
    hasFuture ||
    payments.some(
      (other) => other.transactionId === null && other.dueOn > payment.dueOn
    )
  )
}
