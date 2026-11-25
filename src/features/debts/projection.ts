import { shiftMonth } from "@/libs/dates"
import { formatNumber } from "@/libs/format"
import { roundCents } from "@/libs/money"
import { type DebtCalcInput, isActiveDebt } from "./calculations"
import { cardMonthlyPayment } from "./card-cycle"
import type { RateType } from "./debt-schemas"

// Tasa mensual, interés y proyección de pago de una deuda (SPEC 06)

const RATE_TYPE_LABELS: Record<RateType, string> = {
  ea: "E.A.",
  mv: "M.V."
}

/** "28,5 % E.A." */
export function formatRate(rate: number, rateType: RateType) {
  return `${formatNumber(rate, { maximumFractionDigits: 3 })} % ${RATE_TYPE_LABELS[rateType]}`
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

const MAX_PROJECTION_MONTHS = 600

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
    (debt.kind === "loan" ? debt.installment : cardMonthlyPayment(debt)) ??
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
