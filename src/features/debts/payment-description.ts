import { todayISO } from "@/libs/dates"
import { buildPaymentDescription } from "@/libs/payment-description"
import { type DebtCalcInput, nextPayment } from "./calculations"

/** Descripción prellenada del movimiento según el tipo de pago (SPEC 41) */
export interface DebtPaymentDescriptions {
  /** Pago del ciclo: "Pago {nombre} · noviembre" */
  payment: string
  /** Abono extra, sin cuota: "Pago {nombre}" */
  extra: string
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
    return { payment: text, extra: text }
  }
  const next = nextPayment(debt, today)
  const extra = buildPaymentDescription("Pago", debt.name, { kind: "none" })
  return {
    payment:
      next && next.status !== "paid"
        ? buildPaymentDescription("Pago", debt.name, {
            kind: "month",
            on: next.dueOn
          })
        : extra,
    extra
  }
}
