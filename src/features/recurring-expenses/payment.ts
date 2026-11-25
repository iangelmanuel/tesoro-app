import { activeAccountId } from "@/features/accounts/active-account"
import { occurrenceDescription } from "./occurrences"
import type { UpcomingPayment } from "./queries"

// Pagar una ocurrencia de un gasto fijo (SPEC 41 y 43). Lo usan el tab de
// gastos fijos del diálogo de movimiento y la tool pay_recurring_expense del
// MCP, para que ambos prellenen lo mismo.

/** Ocurrencia sin pagar más antigua de un gasto fijo que cumple `matches` */
function oldestUnpaid(
  payments: UpcomingPayment[],
  recurringExpenseId: string,
  matches: (dueOn: string) => boolean
) {
  return (
    payments
      .filter(
        (payment) =>
          payment.recurringExpenseId === recurringExpenseId &&
          payment.transactionId === null &&
          matches(payment.dueOn)
      )
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0] ?? null
  )
}

/** Ocurrencia sin pagar más antigua de un gasto fijo, o la de `dueOn` */
export function unpaidOccurrence(
  payments: UpcomingPayment[],
  recurringExpenseId: string,
  dueOn?: string
) {
  return oldestUnpaid(
    payments,
    recurringExpenseId,
    (paymentDueOn) => dueOn === undefined || paymentDueOn === dueOn
  )
}

/**
 * Primera ocurrencia sin pagar de un gasto fijo con vencimiento posterior a
 * `afterDueOn` (Duplicar, SPEC 49): el duplicado del pago de noviembre paga
 * diciembre, o enero si diciembre ya está pagado. null si no queda ninguna
 */
export function nextUnpaidOccurrence(
  payments: UpcomingPayment[],
  recurringExpenseId: string,
  afterDueOn: string
) {
  return oldestUnpaid(
    payments,
    recurringExpenseId,
    (dueOn) => dueOn > afterDueOn
  )
}

/**
 * Valores del gasto que paga una ocurrencia: su monto, su categoría, la
 * cuenta por defecto si sigue activa y "Pago {nombre} · {periodo}". Sin fecha:
 * el pago ocurre hoy y la ocurrencia conserva su vencimiento.
 */
export function recurringPaymentValues(
  payment: UpcomingPayment,
  accounts: Parameters<typeof activeAccountId>[0]
) {
  return {
    amount: payment.amount,
    category_id: payment.category.id,
    account_id: activeAccountId(accounts, payment.accountId),
    description: occurrenceDescription(payment)
  }
}
