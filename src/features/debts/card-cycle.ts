import { dayInMonth, shiftMonth, todayISO } from "@/libs/dates"
import { type DebtCalcInput } from "./calculations"

// Ciclo de pago de una tarjeta o préstamo (SPEC 06, 17 y 42): el pago del
// mes (mínimo o cuotas) y la cuota de manejo

/**
 * Próxima cuota de manejo de una tarjeta activa: el primer `fee_day`
 * posterior a hoy, en el mes actual o el siguiente (el día 31 cae en el
 * último día de los meses cortos). null sin cuota o si la tarjeta no está
 * activa.
 */
export function nextFeeDate(
  debt: Pick<DebtCalcInput, "status" | "fee_day">,
  today = todayISO()
) {
  if (debt.status !== "active" || debt.fee_day === null) {
    return null
  }

  const thisMonth = today.slice(0, 7)
  const candidate = dayInMonth(thisMonth, debt.fee_day)

  return candidate > today
    ? candidate
    : dayInMonth(shiftMonth(thisMonth, 1), debt.fee_day)
}

type PaymentFields = Pick<
  DebtCalcInput,
  | "kind"
  | "installment"
  | "min_payment"
  | "balance"
  | "installments_due_current"
  | "installments_due_previous"
>

/** Ciclo de pago: el del próximo vencimiento o el anterior */
export type PaymentCycle = "current" | "previous"

/**
 * Pago del mes de una tarjeta sin tope (SPEC 42): el mayor entre el pago
 * mínimo y la suma de las cuotas del ciclo. null sin mínimo ni cuotas.
 */
export function cardMonthlyPayment(
  debt: Pick<
    DebtCalcInput,
    "min_payment" | "installments_due_current" | "installments_due_previous"
  >,
  cycle: PaymentCycle = "current"
) {
  const installments =
    (cycle === "current"
      ? debt.installments_due_current
      : debt.installments_due_previous) ?? 0

  if (debt.min_payment === null && installments <= 0) {
    return null
  }
  return Math.max(debt.min_payment ?? 0, installments)
}

/**
 * Cuota del préstamo o pago del mes de la tarjeta (mínimo o cuotas, el
 * mayor), con tope en el saldo. null en una tarjeta sin mínimo ni cuotas o en
 * una cuenta por cobrar.
 */
export function requiredPayment(
  debt: PaymentFields,
  cycle: PaymentCycle = "current"
) {
  const payment =
    debt.kind === "loan"
      ? debt.installment
      : debt.kind === "credit_card"
        ? cardMonthlyPayment(debt, cycle)
        : null

  return payment === null ? null : Math.min(payment, debt.balance)
}

/**
 * Parte del pago del mes de una tarjeta que viene de compras a cuotas, o null
 * si no hay cuotas en el ciclo
 */
export function installmentsShare(
  debt: Pick<DebtCalcInput, "kind" | "installments_due_current">
) {
  const due = debt.installments_due_current ?? 0
  return debt.kind === "credit_card" && due > 0 ? due : null
}
