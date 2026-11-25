// Tipo base de una deuda (DebtCalcInput), su saldo y su estado: totales,
// porcentajes, etiquetas y orden de tarjetas, préstamos y cuentas por cobrar
// (SPEC 06 y 28). Ciclo de pago, próxima cuota, utilización y proyección van
// en card-cycle.ts, next-payment.ts, utilization.ts y projection.ts.
import type { OccurrenceTone } from "@/features/recurring-expenses/occurrences"
import { todayISO } from "@/libs/dates"
import type { DebtKind, RateType } from "./debt-schemas"
import type { ReceivableSchedule } from "./receivable-schemas"

export type DebtStatus = "active" | "paid" | "archived"

/** Campos de una deuda (fila de debt_overview) que usan los cálculos */
export interface DebtCalcInput {
  kind: DebtKind
  status: DebtStatus
  opening_balance: number
  credit_limit: number | null
  min_payment: number | null
  installment: number | null
  original_amount: number | null
  interest_rate: number | null
  rate_type: RateType | null
  expected_on: string | null
  fee_amount: number | null
  fee_day: number | null
  created_at: string
  balance: number
  next_due_on: string | null
  prev_due_on: string | null
  paid_current_cycle: number | null
  paid_previous_cycle: number | null
  /**
   * Σ cuotas de compras y avances que caen en el próximo vencimiento y en el
   * anterior (SPEC 42). Solo tarjetas; sin ellas, 0 o ausente
   */
  installments_due_current?: number | null
  installments_due_previous?: number | null
}

/** Activa y de tipo tarjeta o préstamo */
export function isActiveDebt(debt: Pick<DebtCalcInput, "kind" | "status">) {
  return debt.status === "active" && debt.kind !== "receivable"
}

/** Σ saldo de tarjetas y préstamos activos */
export function totalDebt(debts: DebtCalcInput[]) {
  return debts.filter(isActiveDebt).reduce((sum, debt) => sum + debt.balance, 0)
}

/** Campos del tipo de cobro de una cuenta por cobrar (SPEC 28) */
interface ReceivableScheduleFields {
  kind: DebtKind
  schedule: ReceivableSchedule | null
  term_months: number | null
}

/**
 * Cuenta por cobrar mes a mes sin número de cuotas (SPEC 28): no tiene saldo
 * total, así que no suma en "Te deben" ni se marca como cobrada por saldo 0
 */
export function isOpenEndedReceivable(debt: ReceivableScheduleFields) {
  return (
    debt.kind === "receivable" &&
    debt.schedule === "monthly" &&
    debt.term_months === null
  )
}

/** Σ saldo de cuentas por cobrar activas, sin las mensuales indefinidas */
export function totalReceivable(
  debts: (Pick<DebtCalcInput, "status" | "balance"> &
    ReceivableScheduleFields)[]
) {
  return debts
    .filter(
      (debt) =>
        debt.kind === "receivable" &&
        debt.status === "active" &&
        !isOpenEndedReceivable(debt)
    )
    .reduce((sum, debt) => sum + debt.balance, 0)
}

/** % pagado de un préstamo con monto original, o null. Mínimo 0. */
export function paidPercent(
  debt: Pick<DebtCalcInput, "kind" | "original_amount" | "balance">
) {
  if (debt.kind !== "loan" || debt.original_amount === null) {
    return null
  }
  return Math.max(
    Math.floor(
      ((debt.original_amount - debt.balance) / debt.original_amount) * 100
    ),
    0
  )
}

/** % cobrado de una cuenta por cobrar. Mínimo 0. */
export function collectedPercent(
  debt: Pick<DebtCalcInput, "opening_balance" | "balance">
) {
  return Math.max(
    Math.floor(
      ((debt.opening_balance - debt.balance) / debt.opening_balance) * 100
    ),
    0
  )
}

/**
 * Orden de las deudas activas: próximo vencimiento más cercano primero y las
 * que no tienen (cuentas por cobrar) al final; empates por creación
 */
export function compareByNextDue(
  a: Pick<DebtCalcInput, "next_due_on" | "created_at">,
  b: Pick<DebtCalcInput, "next_due_on" | "created_at">
) {
  if (a.next_due_on !== b.next_due_on) {
    if (a.next_due_on === null) return 1
    if (b.next_due_on === null) return -1
    return a.next_due_on < b.next_due_on ? -1 : 1
  }
  return a.created_at.localeCompare(b.created_at)
}

/**
 * Orden de las cuentas por cobrar activas: fecha esperada más cercana
 * primero y las que no tienen al final; empates por creación
 */
export function compareByExpectedOn(
  a: Pick<DebtCalcInput, "expected_on" | "created_at">,
  b: Pick<DebtCalcInput, "expected_on" | "created_at">
) {
  if (a.expected_on !== b.expected_on) {
    if (a.expected_on === null) return 1
    if (b.expected_on === null) return -1
    return a.expected_on < b.expected_on ? -1 : 1
  }
  return a.created_at.localeCompare(b.created_at)
}

/** Etiqueta de una deuda pagada o archivada, o null si está activa */
export function debtStatusLabel(
  debt: Pick<DebtCalcInput, "kind" | "status">
): { label: string; tone: OccurrenceTone } | null {
  if (debt.status === "paid") {
    return {
      label: debt.kind === "receivable" ? "Cobrada" : "Pagada",
      tone: "success"
    }
  }
  if (debt.status === "archived") {
    return { label: "Archivada", tone: "neutral" }
  }
  return null
}

/** Cuenta por cobrar activa con fecha esperada pasada y saldo */
export function isReceivableOverdue(
  debt: Pick<DebtCalcInput, "kind" | "status" | "expected_on" | "balance">,
  today = todayISO()
) {
  return (
    debt.kind === "receivable" &&
    debt.status === "active" &&
    debt.expected_on !== null &&
    debt.expected_on < today &&
    debt.balance > 0
  )
}

/**
 * Activa con saldo 0: se puede marcar como pagada o cobrada. Una mensual
 * indefinida arranca en 0 sin estar cobrada: sigue activa hasta archivarla
 */
export function hasZeroBalance(
  debt: Pick<DebtCalcInput, "status" | "balance"> & ReceivableScheduleFields
) {
  return (
    debt.status === "active" &&
    debt.balance === 0 &&
    !isOpenEndedReceivable(debt)
  )
}
