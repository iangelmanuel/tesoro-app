import { monthName } from "@/features/recurring-expenses/occurrences"
import type { IncomeFrequency } from "./schemas"

// Funciones puras: las usan componentes de servidor y de cliente

export type IncomeOccurrenceStatus =
  "received" | "overdue" | "today" | "pending"

export type IncomeOccurrenceTone = "success" | "danger" | "warning" | "neutral"

export const INCOME_OCCURRENCE_STATUS: Record<
  IncomeOccurrenceStatus,
  { label: string; tone: IncomeOccurrenceTone }
> = {
  received: { label: "Recibido", tone: "success" },
  overdue: { label: "Atrasado", tone: "danger" },
  today: { label: "De hoy", tone: "warning" },
  pending: { label: "Pendiente", tone: "neutral" }
}

// `due_on` y `today` son fechas YYYY-MM-DD en America/Bogota; como texto ISO
// se comparan en orden cronológico
export function getIncomeOccurrenceStatus(
  occurrence: { due_on: string; transaction_id: string | null },
  today: string
): IncomeOccurrenceStatus {
  if (occurrence.transaction_id !== null) {
    return "received"
  }
  if (occurrence.due_on < today) {
    return "overdue"
  }
  if (occurrence.due_on === today) {
    return "today"
  }
  return "pending"
}

interface IncomeSchedule {
  frequency: IncomeFrequency
  day_of_month: number | null
  second_day_of_month: number | null
  month_of_year: number | null
  starts_on: string
  ends_on: string | null
}

const pad = (value: number) => String(value).padStart(2, "0")

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Fechas de vencimiento (YYYY-MM-DD) de un ingreso fijo en [from, to], en
 * orden. Un día que no existe en el mes cae en el último día del mes
 * (30 → 28 o 29 de febrero; 31 → 30 de abril). Igual que la RPC
 * recurring_income_occurrences.
 */
export function incomeDueDates(
  income: IncomeSchedule,
  from: string,
  to: string
): string[] {
  if (income.frequency === "none" || income.day_of_month === null) {
    return []
  }

  const start = from > income.starts_on ? from : income.starts_on
  const end =
    income.ends_on !== null && income.ends_on < to ? income.ends_on : to
  if (start > end) {
    return []
  }

  const days = [income.day_of_month, income.second_day_of_month].filter(
    (day): day is number => day !== null
  )
  const dates = new Set<string>()
  let [year, month] = start.split("-").map(Number)
  const [endYear, endMonth] = end.split("-").map(Number)

  while (year < endYear || (year === endYear && month <= endMonth)) {
    if (income.frequency !== "yearly" || month === income.month_of_year) {
      const last = lastDayOfMonth(year, month)
      for (const day of days) {
        const date = `${year}-${pad(month)}-${pad(Math.min(day, last))}`
        if (date >= start && date <= end) {
          dates.add(date)
        }
      }
    }
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }

  return [...dates].sort()
}

const SHORT_MONTH = new Intl.DateTimeFormat("es-CO", {
  month: "short",
  timeZone: "UTC"
})

function shortMonth(month: number) {
  return SHORT_MONTH.format(new Date(Date.UTC(2000, month - 1, 1))).replace(
    ".",
    ""
  )
}

/**
 * Texto de una ocurrencia bajo el select "Ingreso fijo":
 * "Quincena del 15 nov", "Mes de noviembre" o "Año 2026"
 */
export function occurrenceLabel(frequency: IncomeFrequency, dueOn: string) {
  const [year, month, day] = dueOn.split("-").map(Number)

  if (frequency === "biweekly") {
    return `Quincena del ${day} ${shortMonth(month)}`
  }
  if (frequency === "yearly") {
    return `Año ${year}`
  }
  return `Mes de ${monthName(month)}`
}

/**
 * "Mensual, día 5", "Quincenal, días 15 y 30", "Anual, 15 de marzo" o
 * "Sin fecha fija"
 */
export function incomeFrequencyLabel(income: {
  frequency: IncomeFrequency
  day_of_month: number | null
  second_day_of_month: number | null
  month_of_year: number | null
}) {
  switch (income.frequency) {
    case "monthly":
      return `Mensual, día ${income.day_of_month}`
    case "biweekly":
      return `Quincenal, días ${income.day_of_month} y ${income.second_day_of_month}`
    case "yearly":
      return income.month_of_year === null
        ? `Anual, día ${income.day_of_month}`
        : `Anual, ${income.day_of_month} de ${monthName(income.month_of_year)}`
    case "none":
      return "Sin fecha fija"
  }
}
