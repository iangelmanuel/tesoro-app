import type { OccurrenceTone } from "@/features/recurring-expenses/occurrences"
import { todayISO } from "@/libs/dates"
import { type DebtCalcInput, isActiveDebt } from "./calculations"
import { requiredPayment } from "./card-cycle"

// Próximo pago de una tarjeta o préstamo (SPEC 06 y 16): su estado (vencido,
// pagado, de hoy o pendiente) y el orden de los próximos pagos. Las fechas
// son YYYY-MM-DD en America/Bogota; como texto ISO se comparan en orden
// cronológico.

export type PaymentStatus = "overdue" | "paid" | "today" | "pending"

export const PAYMENT_STATUS: Record<
  PaymentStatus,
  { label: string; tone: OccurrenceTone }
> = {
  overdue: { label: "Vencido", tone: "danger" },
  paid: { label: "Pagado", tone: "success" },
  today: { label: "Hoy", tone: "warning" },
  pending: { label: "Pendiente", tone: "neutral" }
}

/**
 * Próximo pago de una tarjeta o préstamo activo con saldo > 0, o null si no
 * aplica. `status` es null en una tarjeta sin pago mínimo (solo fecha).
 */
export function nextPayment(
  debt: DebtCalcInput,
  today = todayISO()
): {
  status: PaymentStatus | null
  dueOn: string
  amount: number | null
} | null {
  if (!isActiveDebt(debt) || debt.balance <= 0 || debt.next_due_on === null) {
    return null
  }

  const required = requiredPayment(debt)
  // En una tarjeta con cuotas el pago del ciclo anterior puede ser otro
  const requiredBefore = requiredPayment(debt, "previous")
  const current = debt.paid_current_cycle ?? 0
  const previous = debt.paid_previous_cycle ?? 0
  const prevDueOn = debt.prev_due_on
  // "La deuda existía en D_b": su fecha de creación en America/Bogota ≤ D_b
  const existedAtPrevDue =
    prevDueOn !== null && todayISO(new Date(debt.created_at)) <= prevDueOn

  if (
    requiredBefore !== null &&
    previous < requiredBefore &&
    current < requiredBefore &&
    existedAtPrevDue
  ) {
    return { status: "overdue", dueOn: prevDueOn, amount: requiredBefore }
  }
  if (required === null) {
    return { status: null, dueOn: debt.next_due_on, amount: null }
  }
  if (current >= required) {
    return { status: "paid", dueOn: debt.next_due_on, amount: required }
  }
  if (debt.next_due_on === today) {
    return { status: "today", dueOn: debt.next_due_on, amount: required }
  }
  return { status: "pending", dueOn: debt.next_due_on, amount: required }
}

/** Próximos pagos de las deudas activas: vencidos primero y luego por fecha */
export function upcomingPayments<T extends DebtCalcInput>(
  debts: T[],
  today = todayISO()
) {
  return debts
    .map((debt) => ({ debt, payment: nextPayment(debt, today) }))
    .filter(
      (item): item is { debt: T; payment: NonNullable<typeof item.payment> } =>
        item.payment !== null
    )
    .sort((a, b) => {
      const aOverdue = a.payment.status === "overdue"
      const bOverdue = b.payment.status === "overdue"
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1
      return a.payment.dueOn.localeCompare(b.payment.dueOn)
    })
}
