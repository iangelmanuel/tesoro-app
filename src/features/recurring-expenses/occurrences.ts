import type { Tone } from "@/components/dashboard/feedback/tone"
import { buildPaymentDescription } from "@/libs/payment-description"
import type { RecurringFrequency } from "./schemas"

export type OccurrenceStatus = "paid" | "overdue" | "today" | "upcoming"

/** Tonos de una ocurrencia: los de tone.ts sin info */
export type OccurrenceTone = Exclude<Tone, "info">

export const OCCURRENCE_STATUS: Record<
  OccurrenceStatus,
  { label: string; tone: OccurrenceTone }
> = {
  paid: { label: "Pagado", tone: "success" },
  overdue: { label: "Atrasado", tone: "danger" },
  today: { label: "Hoy", tone: "warning" },
  upcoming: { label: "Próximo", tone: "neutral" }
}

/**
 * Estado de una ocurrencia: pagada si tiene movimiento; si no, atrasada, de
 * hoy o próxima. `due_on` y `today` son fechas YYYY-MM-DD en America/Bogota:
 * como texto ISO se comparan en orden cronológico.
 */
export function getOccurrenceStatus(
  occurrence: { due_on: string; transaction_id: string | null },
  today: string
): OccurrenceStatus {
  if (occurrence.transaction_id !== null) {
    return "paid"
  }
  if (occurrence.due_on < today) {
    return "overdue"
  }
  if (occurrence.due_on === today) {
    return "today"
  }
  return "upcoming"
}

const MONTH_NAME = new Intl.DateTimeFormat("es-CO", {
  month: "long",
  timeZone: "UTC"
})

/** Nombre del mes en español (1 = enero) */
export function monthName(month: number) {
  return MONTH_NAME.format(new Date(Date.UTC(2000, month - 1, 1)))
}

/** Opciones del select "Mes de pago": 1 → "Enero" */
export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const name = monthName(index + 1)
  return {
    value: String(index + 1),
    label: name.charAt(0).toUpperCase() + name.slice(1)
  }
})

/** "Mensual, día 5" o "Anual, 15 de marzo" */
export function frequencyLabel(expense: {
  frequency: RecurringFrequency
  day_of_month: number
  month_of_year: number | null
}) {
  if (expense.frequency === "yearly" && expense.month_of_year !== null) {
    return `Anual, ${expense.day_of_month} de ${monthName(expense.month_of_year)}`
  }
  return `Mensual, día ${expense.day_of_month}`
}

/**
 * "Pago {nombre} · {periodo}" de la cuota que se paga, no de hoy (SPEC 41):
 * el mes de la cuota ("noviembre"), también en los anuales
 */
export function occurrenceDescription(payment: {
  name: string
  frequency: RecurringFrequency
  dueOn: string
}) {
  return buildPaymentDescription("Pago", payment.name, {
    kind: payment.frequency === "yearly" ? "year" : "month",
    on: payment.dueOn
  })
}
