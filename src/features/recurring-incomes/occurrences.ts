import { monthName } from "@/features/recurring-expenses/occurrences"
import type { IncomeFrequency } from "./schemas"

// Funciones puras: las usan componentes de servidor y de cliente

export type IncomeOccurrenceStatus =
  "received" | "partial" | "today" | "pending" | "overdue"

export type IncomeOccurrenceTone = "success" | "danger" | "warning" | "neutral"

export const INCOME_OCCURRENCE_STATUS: Record<
  IncomeOccurrenceStatus,
  { label: string; tone: IncomeOccurrenceTone }
> = {
  received: { label: "Recibido", tone: "success" },
  partial: { label: "Abonado", tone: "warning" },
  overdue: { label: "Atrasado", tone: "danger" },
  today: { label: "De hoy", tone: "warning" },
  pending: { label: "Pendiente", tone: "neutral" }
}

const toCents = (value: number) => Math.round(value * 100)

/** Lo que falta por recibir de una ocurrencia (0 si ya se cubrió) */
export function occurrenceRemaining(occurrence: {
  amount: number
  received_amount: number
}) {
  const cents = toCents(occurrence.amount) - toCents(occurrence.received_amount)
  return Math.max(cents, 0) / 100
}

// Recibido: lo asignado suma el monto esperado o más. Abonado: hay algo
// asignado, pero menos que el esperado. Sin asignaciones, según la fecha.
// `due_on` y `today` son fechas YYYY-MM-DD en America/Bogota; como texto ISO
// se comparan en orden cronológico
export function getIncomeOccurrenceStatus(
  occurrence: { due_on: string; amount: number; received_amount: number },
  today: string
): IncomeOccurrenceStatus {
  if (occurrence.received_amount > 0) {
    return occurrenceRemaining(occurrence) === 0 ? "received" : "partial"
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
  day_of_week: number | null
  interval_days: number | null
  starts_on: string
  ends_on: string | null
}

const pad = (value: number) => String(value).padStart(2, "0")

const DAY_MS = 86_400_000

const toUTC = (date: string) => Date.parse(`${date}T00:00:00Z`)

const fromUTC = (time: number) => new Date(time).toISOString().slice(0, 10)

/** Día ISO de la semana de una fecha YYYY-MM-DD: 1 lunes … 7 domingo */
export function isoWeekday(date: string) {
  const day = new Date(toUTC(date)).getUTCDay()
  return day === 0 ? 7 : day
}

/** Fechas desde `first` hasta `end` (inclusive) cada `step` días */
function stepDates(first: number, end: number, step: number) {
  const dates: string[] = []
  for (let time = first; time <= end; time += step * DAY_MS) {
    dates.push(fromUTC(time))
  }
  return dates
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Fechas de vencimiento (YYYY-MM-DD) de un ingreso fijo en [from, to], en
 * orden. Igual que la RPC recurring_income_dates:
 * - mensual, quincenal y anual: un día que no existe en el mes cae en el
 *   último día del mes (30 → 28 o 29 de febrero; 31 → 30 de abril);
 * - semanal: el día ISO de la semana (1 lunes … 7 domingo);
 * - diaria: todos los días;
 * - cada N días: contados desde `starts_on`;
 * - "Sin fecha fija": ninguna.
 */
export function incomeDueDates(
  income: IncomeSchedule,
  from: string,
  to: string
): string[] {
  if (income.frequency === "none") {
    return []
  }

  const start = from > income.starts_on ? from : income.starts_on
  const end =
    income.ends_on !== null && income.ends_on < to ? income.ends_on : to
  if (start > end) {
    return []
  }

  const startTime = toUTC(start)
  const endTime = toUTC(end)

  if (income.frequency === "daily") {
    return stepDates(startTime, endTime, 1)
  }
  if (income.frequency === "weekly") {
    if (income.day_of_week === null) {
      return []
    }
    const offset = (income.day_of_week - isoWeekday(start) + 7) % 7
    return stepDates(startTime + offset * DAY_MS, endTime, 7)
  }
  if (income.frequency === "every_n_days") {
    const step = income.interval_days
    if (step === null) {
      return []
    }
    const origin = toUTC(income.starts_on)
    const elapsed = Math.round((startTime - origin) / DAY_MS)
    const first = origin + Math.ceil(elapsed / step) * step * DAY_MS
    return stepDates(first, endTime, step)
  }

  if (income.day_of_month === null) {
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

const WEEKDAY_NAMES = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo"
] as const

/** Nombre del día ISO de la semana: 1 → "lunes" … 7 → "domingo" */
export function weekdayName(day: number) {
  return WEEKDAY_NAMES[day - 1] ?? ""
}

/** "sáb 8 nov" */
export function shortOccurrenceDate(dueOn: string) {
  const [, month, day] = dueOn.split("-").map(Number)
  const weekday = weekdayName(isoWeekday(dueOn)).slice(0, 3)
  return `${weekday} ${day} ${shortMonth(month)}`
}

/**
 * Texto de una ocurrencia bajo el select "Ingreso fijo":
 * "Quincena del 15 nov", "Mes de noviembre", "Año 2026" o, en semanal,
 * diaria y cada N días, la fecha ("sáb 8 nov")
 */
export function occurrenceLabel(frequency: IncomeFrequency, dueOn: string) {
  const [year, month, day] = dueOn.split("-").map(Number)

  switch (frequency) {
    case "biweekly":
      return `Quincena del ${day} ${shortMonth(month)}`
    case "yearly":
      return `Año ${year}`
    case "weekly":
    case "daily":
    case "every_n_days":
      return shortOccurrenceDate(dueOn)
    default:
      return `Mes de ${monthName(month)}`
  }
}

/**
 * "Mensual, día 5", "Quincenal, días 15 y 30", "Anual, 15 de marzo",
 * "Semanal, cada sábado", "Diario", "Cada 14 días" o "Sin fecha fija"
 */
export function incomeFrequencyLabel(income: {
  frequency: IncomeFrequency
  day_of_month: number | null
  second_day_of_month: number | null
  month_of_year: number | null
  day_of_week: number | null
  interval_days: number | null
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
    case "weekly":
      return income.day_of_week === null
        ? "Semanal"
        : `Semanal, cada ${weekdayName(income.day_of_week)}`
    case "daily":
      return "Diario"
    case "every_n_days":
      return `Cada ${income.interval_days} días`
    case "none":
      return "Sin fecha fija"
  }
}
