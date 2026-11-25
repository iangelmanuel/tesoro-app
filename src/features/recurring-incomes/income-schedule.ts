import {
  MONTH_OPTIONS,
  monthName
} from "@/features/recurring-expenses/occurrences"
import { formatShortDate } from "@/libs/format"
import { isoWeekday, weekdayName } from "./occurrences"
import type { RecurringIncome } from "./queries"
import {
  BIWEEKLY_DEFAULT_DAYS,
  INCOME_FREQUENCIES,
  INTERVAL_DAYS_MAX,
  INTERVAL_DAYS_MIN,
  type IncomeFrequency
} from "./schemas"

// Calendario de un ingreso fijo en su formulario (SPEC 38): opciones de los
// selects y el resumen en vivo. Puro: lo usa el diálogo (cliente).

/** "enero" → "Enero" */
const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1)

export { MONTH_OPTIONS }

/** Días ISO del select "Día de la semana": 1 → "Lunes" */
export const WEEKDAY_OPTIONS = Array.from({ length: 7 }, (_, index) => ({
  value: String(index + 1),
  label: capitalize(weekdayName(index + 1))
}))

/** Nombre de cada frecuencia en el select */
const FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  yearly: "Anual",
  daily: "Diaria",
  every_n_days: "Cada N días",
  none: "Sin fecha fija"
}

/** Opciones del select "Frecuencia", en el orden de INCOME_FREQUENCIES */
export const FREQUENCY_OPTIONS = INCOME_FREQUENCIES.map((value) => ({
  value,
  label: FREQUENCY_LABELS[value]
}))

/** Ayuda bajo el select "Frecuencia" */
export const FREQUENCY_HINTS: Record<IncomeFrequency, string> = {
  weekly: "Llega una vez por semana, como el rendimiento de una inversión.",
  biweekly: "Llega dos veces al mes, como la nómina por quincenas.",
  monthly: "Llega una vez al mes, como un salario mensual o un arriendo.",
  yearly: "Llega una vez al año, como una prima o un dividendo anual.",
  daily: "Llega todos los días, como las ventas diarias de un puesto.",
  every_n_days: "Llega cada cierto número de días, contados desde el inicio.",
  none: "Para proyectos o inversiones sin fecha fija. Solo suma lo que recibes."
}

/** Valores del calendario como texto, tal como están en el formulario */
export interface ScheduleDraft {
  frequency: IncomeFrequency
  dayOfMonth: string
  secondDay: string
  monthOfYear: string
  dayOfWeek: string
  intervalDays: string
  startsOn: string
  endsOn: string
}

const dayText = (value: number | null | undefined) =>
  value == null ? "" : String(value)

/** Calendario de un ingreso fijo como texto del formulario, o el de uno nuevo */
export function initialScheduleDraft(
  income:
    | Pick<
        RecurringIncome,
        | "frequency"
        | "day_of_month"
        | "second_day_of_month"
        | "month_of_year"
        | "day_of_week"
        | "interval_days"
        | "starts_on"
        | "ends_on"
      >
    | undefined,
  today: string
): ScheduleDraft {
  return {
    frequency: income?.frequency ?? "monthly",
    dayOfMonth: dayText(income?.day_of_month),
    secondDay: dayText(income?.second_day_of_month),
    monthOfYear: dayText(income?.month_of_year),
    dayOfWeek: dayText(income?.day_of_week),
    intervalDays: dayText(income?.interval_days),
    startsOn: income?.starts_on ?? today,
    endsOn: income?.ends_on ?? ""
  }
}

/**
 * Cambia la frecuencia: la quincenal propone 15 y 30 si los días están
 * vacíos y la semanal, el día de la semana de la fecha de inicio
 */
export function withFrequency(
  draft: ScheduleDraft,
  next: IncomeFrequency
): ScheduleDraft {
  if (next === draft.frequency) return draft
  const result = { ...draft, frequency: next }
  if (next === "biweekly") {
    if (!result.dayOfMonth) result.dayOfMonth = String(BIWEEKLY_DEFAULT_DAYS[0])
    if (!result.secondDay) result.secondDay = String(BIWEEKLY_DEFAULT_DAYS[1])
  }
  if (next === "weekly" && !result.dayOfWeek && result.startsOn) {
    result.dayOfWeek = String(isoWeekday(result.startsOn))
  }
  return result
}

const toNumber = (value: string) => (value === "" ? null : Number(value))

/** ¿El intervalo de "Cada N días" es válido? */
function isValidInterval(interval: number | null): interval is number {
  return (
    interval !== null &&
    Number.isInteger(interval) &&
    interval >= INTERVAL_DAYS_MIN &&
    interval <= INTERVAL_DAYS_MAX
  )
}

/** Frase del calendario sin la fecha de fin, o null si faltan datos */
function scheduleText(draft: ScheduleDraft): string | null {
  const day = toNumber(draft.dayOfMonth)
  const second = toNumber(draft.secondDay)
  const month = toNumber(draft.monthOfYear)
  const weekday = toNumber(draft.dayOfWeek)
  const interval = toNumber(draft.intervalDays)
  const since = draft.startsOn ? formatShortDate(draft.startsOn) : null

  switch (draft.frequency) {
    case "weekly":
      return weekday === null ? null : `Cada ${weekdayName(weekday)}`
    case "daily":
      return since && `Todos los días desde el ${since}`
    case "every_n_days":
      return isValidInterval(interval) && since
        ? `Cada ${interval} días desde el ${since}`
        : null
    case "monthly":
      return day === null ? null : `Cada mes, el día ${day}`
    case "biweekly":
      return day === null || second === null
        ? null
        : `Los días ${day} y ${second} de cada mes`
    case "yearly":
      return day === null || month === null
        ? null
        : `Cada ${day} de ${monthName(month)}`
    case "none":
      return null
  }
}

/**
 * Resumen en vivo del calendario: "Cada sábado", "Cada 14 días desde el
 * 3 nov", "Los días 15 y 30 de cada mes"… con "hasta el …" si tiene fin.
 * null si faltan datos o es "Sin fecha fija".
 */
export function scheduleSummary(draft: ScheduleDraft): string | null {
  const text = scheduleText(draft)
  if (text && draft.endsOn) {
    return `${text} hasta el ${formatShortDate(draft.endsOn)}`
  }
  return text
}
