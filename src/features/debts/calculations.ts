import { SITE } from "@/config/site"
import type { OccurrenceTone } from "@/features/recurring-expenses/occurrences"
import { shiftMonth, todayISO } from "@/libs/dates"
import type { DebtKind, RateType } from "./schemas"

export const DEBTS_PATH = `${SITE.routes.dashboardPersonal}/debts` as const

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
  created_at: string
  balance: number
  next_due_on: string | null
  prev_due_on: string | null
  paid_current_cycle: number | null
  paid_previous_cycle: number | null
}

export const RATE_TYPE_LABELS: Record<RateType, string> = {
  ea: "E.A.",
  mv: "M.V."
}

const RATE_FORMAT = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 3
})

/** "28,5 % E.A." */
export function formatRate(rate: number, rateType: RateType) {
  return `${RATE_FORMAT.format(rate)} % ${RATE_TYPE_LABELS[rateType]}`
}

const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat("es-CO", {
  month: "long",
  year: "numeric",
  timeZone: "UTC"
})

/** "octubre de 2027", desde un mes YYYY-MM */
export function formatMonthYear(month: string) {
  return MONTH_YEAR_FORMAT.format(new Date(`${month}-01T00:00:00Z`))
}

/** Activa y de tipo tarjeta o préstamo */
export function isActiveDebt(debt: Pick<DebtCalcInput, "kind" | "status">) {
  return debt.status === "active" && debt.kind !== "receivable"
}

/**
 * Tasa mensual como fracción. E.A.: (1 + i)^(1/12) − 1. M.V.: i. Sin tasa: 0.
 * 26,82 % E.A. ≈ 0,02.
 */
export function monthlyRate(rate: number | null, rateType: RateType | null) {
  if (rate === null || rateType === null) {
    return 0
  }
  return rateType === "ea" ? (1 + rate / 100) ** (1 / 12) - 1 : rate / 100
}

/**
 * Cuota del préstamo o pago mínimo de la tarjeta, con tope en el saldo. null
 * en una tarjeta sin pago mínimo o en una cuenta por cobrar.
 */
export function requiredPayment(
  debt: Pick<DebtCalcInput, "kind" | "installment" | "min_payment" | "balance">
) {
  const payment =
    debt.kind === "loan"
      ? debt.installment
      : debt.kind === "credit_card"
        ? debt.min_payment
        : null

  return payment === null ? null : Math.min(payment, debt.balance)
}

/** Saldo / cupo en porcentaje entero, truncado. Puede pasar de 100. */
export function utilizationPercent(balance: number, creditLimit: number) {
  return Math.max(Math.floor((balance / creditLimit) * 100), 0)
}

export type UtilizationLevel = "healthy" | "moderate" | "high"

export const UTILIZATION_LEVELS: Record<
  UtilizationLevel,
  { label: string; tone: OccurrenceTone }
> = {
  healthy: { label: "Saludable", tone: "success" },
  moderate: { label: "Moderada", tone: "warning" },
  high: { label: "Alta", tone: "danger" }
}

export function utilizationLevel(percent: number): UtilizationLevel {
  if (percent >= 70) return "high"
  if (percent >= 30) return "moderate"
  return "healthy"
}

/** Σ saldos / Σ cupos de las tarjetas activas, o null sin tarjetas activas */
export function globalUtilization(debts: DebtCalcInput[]) {
  const cards = debts.filter(
    (debt) =>
      debt.kind === "credit_card" &&
      debt.status === "active" &&
      debt.credit_limit !== null
  )

  if (cards.length === 0) {
    return null
  }

  const balance = cards.reduce((sum, debt) => sum + debt.balance, 0)
  const limit = cards.reduce((sum, debt) => sum + (debt.credit_limit ?? 0), 0)
  return utilizationPercent(balance, limit)
}

/** Σ saldo de tarjetas y préstamos activos */
export function totalDebt(debts: DebtCalcInput[]) {
  return debts.filter(isActiveDebt).reduce((sum, debt) => sum + debt.balance, 0)
}

/** Σ saldo de cuentas por cobrar activas */
export function totalReceivable(debts: DebtCalcInput[]) {
  return debts
    .filter((debt) => debt.kind === "receivable" && debt.status === "active")
    .reduce((sum, debt) => sum + debt.balance, 0)
}

const roundCents = (value: number) => Math.round(value * 100) / 100

/** Interés estimado del mes: saldo × tasa mensual, en centavos */
export function monthlyInterest(
  debt: Pick<DebtCalcInput, "balance" | "interest_rate" | "rate_type">
) {
  return roundCents(
    debt.balance * monthlyRate(debt.interest_rate, debt.rate_type)
  )
}

/** Interés estimado del mes de las tarjetas y préstamos activos */
export function totalMonthlyInterest(debts: DebtCalcInput[]) {
  return roundCents(
    debts
      .filter(isActiveDebt)
      .reduce((sum, debt) => sum + monthlyInterest(debt), 0)
  )
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

export const MAX_PROJECTION_MONTHS = 600

export type Projection =
  | {
      kind: "ok"
      months: number
      /** Mes del pago total, YYYY-MM */
      payoffMonth: string
      totalInterest: number
    }
  | { kind: "no_progress" }
  | { kind: "too_long" }

/**
 * Simulación mes a mes desde el primer vencimiento `firstDueOn`: el interés
 * (redondeado a centavos) se suma al saldo y luego se resta el pago, hasta
 * llegar a 0. Se calcula en centavos enteros para no acumular error.
 */
export function projectPayoff(
  balance: number,
  rate: number,
  payment: number,
  firstDueOn: string
): Projection {
  let cents = Math.round(balance * 100)
  const paymentCents = Math.round(payment * 100)

  if (paymentCents <= Math.round(cents * rate)) {
    return { kind: "no_progress" }
  }

  let months = 0
  let interestCents = 0

  while (cents > 0) {
    if (months === MAX_PROJECTION_MONTHS) {
      return { kind: "too_long" }
    }
    const interest = Math.round(cents * rate)
    interestCents += interest
    cents = cents + interest - paymentCents
    months += 1
  }

  return {
    kind: "ok",
    months,
    payoffMonth: shiftMonth(firstDueOn.slice(0, 7), months - 1),
    totalInterest: interestCents / 100
  }
}

export type DebtProjection =
  (Projection & { withoutRate: boolean }) | { kind: "needs_min_payment" }

/**
 * Proyección de una tarjeta o préstamo activo con saldo > 0, o null si no
 * aplica. `payment` es el valor del simulador; sin él se usa la cuota o el
 * pago mínimo.
 */
export function debtProjection(
  debt: DebtCalcInput,
  payment?: number
): DebtProjection | null {
  if (!isActiveDebt(debt) || debt.balance <= 0 || debt.next_due_on === null) {
    return null
  }

  const monthlyPayment =
    payment ??
    (debt.kind === "loan" ? debt.installment : debt.min_payment) ??
    null

  if (monthlyPayment === null) {
    return { kind: "needs_min_payment" }
  }

  const projection = projectPayoff(
    debt.balance,
    monthlyRate(debt.interest_rate, debt.rate_type),
    monthlyPayment,
    debt.next_due_on
  )

  return { ...projection, withoutRate: debt.interest_rate === null }
}

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
 * Las fechas son YYYY-MM-DD en America/Bogota; como texto ISO se comparan en
 * orden cronológico.
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

  if (required === null) {
    return { status: null, dueOn: debt.next_due_on, amount: null }
  }

  const current = debt.paid_current_cycle ?? 0
  const previous = debt.paid_previous_cycle ?? 0
  const prevDueOn = debt.prev_due_on
  // "La deuda existía en D_b": su fecha de creación en America/Bogota ≤ D_b
  const existedAtPrevDue =
    prevDueOn !== null && todayISO(new Date(debt.created_at)) <= prevDueOn

  if (previous < required && current < required && existedAtPrevDue) {
    return { status: "overdue", dueOn: prevDueOn, amount: required }
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

/** Activa con saldo 0: se puede marcar como pagada o cobrada */
export function hasZeroBalance(
  debt: Pick<DebtCalcInput, "status" | "balance">
) {
  return debt.status === "active" && debt.balance === 0
}
