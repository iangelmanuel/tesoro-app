import { todayISO } from "@/libs/dates"
import { buildPaymentDescription } from "@/libs/payment-description"
import { type DebtCalcInput, nextPayment } from "./calculations"

/** Valores prellenados del pago según el tipo (SPEC 41) */
export interface DebtPaymentDescriptions {
  /** Pago del ciclo: "Pago {nombre} · noviembre" */
  payment: string
  /** Abono extra, sin cuota: "Pago {nombre}" */
  extra: string
  /**
   * Lo que falta de la cuota del ciclo que se paga (la vencida o la próxima
   * sin cubrir), para prellenar el monto del pago. null sin cuota pendiente
   * (ciclo cubierto, sin pago mínimo o cuenta por cobrar)
   */
  amount: number | null
}

/** Lo que falta de la cuota pendiente, en centavos exactos */
function remainingDue(debt: DebtCalcInput, required: number) {
  const paid = debt.paid_current_cycle ?? 0
  const cents = Math.round(required * 100) - Math.round(paid * 100)
  return cents > 0 ? cents / 100 : null
}

/**
 * Descripciones del pago de una deuda. El pago del ciclo lleva el mes de la
 * cuota que se paga (la vencida o la próxima sin cubrir); con el ciclo ya
 * cubierto o en un abono extra no hay cuota: solo "Pago {nombre}". En una
 * cuenta por cobrar: "Cobro {nombre}"
 */
export function debtPaymentDescriptions(
  debt: DebtCalcInput & { name: string },
  today = todayISO()
): DebtPaymentDescriptions {
  if (debt.kind === "receivable") {
    const text = buildPaymentDescription("Cobro", debt.name, { kind: "none" })
    return { payment: text, extra: text, amount: null }
  }
  const next = nextPayment(debt, today)
  const extra = buildPaymentDescription("Pago", debt.name, { kind: "none" })
  const pending = next && next.status !== "paid" ? next : null
  return {
    payment: pending
      ? buildPaymentDescription("Pago", debt.name, {
          kind: "month",
          on: pending.dueOn
        })
      : extra,
    extra,
    // Lo pagado tarde de una cuota vencida cae en el ciclo actual
    amount: pending?.amount != null ? remainingDue(debt, pending.amount) : null
  }
}
