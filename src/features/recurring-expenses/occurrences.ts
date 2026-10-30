import type { RecurringFrequency } from "./schemas"

export type OccurrenceStatus = "paid" | "overdue" | "today" | "upcoming"

export type OccurrenceTone = "success" | "danger" | "warning" | "neutral"

export const OCCURRENCE_STATUS: Record<
  OccurrenceStatus,
  { label: string; tone: OccurrenceTone }
> = {
  paid: { label: "Pagado", tone: "success" },
  overdue: { label: "Vencido", tone: "danger" },
  today: { label: "Hoy", tone: "warning" },
  upcoming: { label: "Próximo", tone: "neutral" }
}

// `dueOn` y `today` son fechas YYYY-MM-DD en America/Bogota; como texto ISO
// se comparan en orden cronológico
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
