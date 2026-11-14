import {
  type Allocation,
  type Period,
  allocateOldestFirst
} from "@/libs/allocate"
import {
  incomeDueDates,
  occurrenceRemaining,
  shortOccurrenceDate
} from "./occurrences"
import type { IncomeFrequency } from "./schemas"
import type { IncomeAllocation } from "./types"

// Reparto de un cobro entre las ocurrencias de un ingreso fijo (SPEC 38).
// Funciones puras para la vista previa del cliente: la regla es la misma de
// allocate_income_receipt, que es la que manda al guardar.

/** Ocurrencias futuras que un cobro puede cubrir por adelantado */
export const FUTURE_OCCURRENCE_LIMIT = 12

export const FUTURE_LIMIT_ERROR = `El monto cubre más de ${FUTURE_OCCURRENCE_LIMIT} ocurrencias futuras`
export const EXCEEDS_END_ERROR =
  "El monto supera lo que falta por recibir de este ingreso fijo"

interface IncomeSchedule {
  frequency: IncomeFrequency
  amount: number
  day_of_month: number | null
  second_day_of_month: number | null
  month_of_year: number | null
  day_of_week: number | null
  interval_days: number | null
  starts_on: string
  ends_on: string | null
}

/** Ocurrencias en las que un cobro nuevo puede repartirse */
export interface IncomeReceiptPeriods {
  /**
   * Vencidas, de hoy y abonadas con lo que les falta (`due` > 0), seguidas de
   * las próximas FUTURE_OCCURRENCE_LIMIT futuras (`due` puede ser 0 si ya se
   * cubrieron por adelantado: igual cuentan para el tope)
   */
  periods: Period[]
  /**
   * true si hay más ocurrencias después de las futuras de `periods`: lo que
   * sobra choca con el tope de futuras. false: choca con `ends_on`
   */
  futureLimited: boolean
}

export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10)

const addMonths = (date: string, months: number) => {
  const [year, month, day] = date.split("-").map(Number)
  const value = new Date(Date.UTC(year, month - 1 + months, day))
  return value.toISOString().slice(0, 10)
}

/**
 * Fin de la ventana que alcanza para FUTURE_OCCURRENCE_LIMIT + 1 ocurrencias
 * futuras de cada frecuencia (la misma de allocate_income_receipt)
 */
export function futureWindowEnd(income: IncomeSchedule, today: string) {
  switch (income.frequency) {
    case "yearly":
      return addMonths(today, 13 * 12)
    case "monthly":
    case "biweekly":
      return addMonths(today, 13)
    case "weekly":
      return addDays(today, 13 * 7)
    case "daily":
      return addDays(today, 13)
    default:
      return addDays(today, 13 * (income.interval_days ?? 1))
  }
}

/**
 * Periodos de reparto de una fuente. `received` lleva lo asignado por fecha
 * (todas las asignaciones de la fuente). "Sin fecha fija" no tiene periodos.
 */
export function incomeReceiptPeriods(
  income: IncomeSchedule,
  received: Map<string, number>,
  today: string
): IncomeReceiptPeriods {
  if (income.frequency === "none") {
    return { periods: [], futureLimited: false }
  }

  const dates = incomeDueDates(
    income,
    income.starts_on,
    futureWindowEnd(income, today)
  )
  const periods: Period[] = []
  let future = 0

  for (const date of dates) {
    const due = occurrenceRemaining({
      amount: income.amount,
      received_amount: received.get(date) ?? 0
    })
    if (date > today) {
      future += 1
      if (future > FUTURE_OCCURRENCE_LIMIT) {
        return { periods, futureLimited: true }
      }
      periods.push({ key: date, due })
    } else if (due > 0) {
      periods.push({ key: date, due })
    }
  }
  return { periods, futureLimited: false }
}

/**
 * Al editar un ingreso, lo que ya tenía asignado no cuenta: se suma de nuevo
 * a lo que falta de cada ocurrencia (o la ocurrencia vuelve a la lista)
 */
function withoutOwn(periods: Period[], own: IncomeAllocation[]): Period[] {
  if (own.length === 0) {
    return periods
  }
  const byKey = new Map(periods.map((period) => [period.key, period.due]))
  for (const allocation of own) {
    byKey.set(
      allocation.due_on,
      (byKey.get(allocation.due_on) ?? 0) + allocation.amount
    )
  }
  return [...byKey]
    .map(([key, due]) => ({ key, due }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

export interface IncomeReceiptPreview {
  /** Ocurrencias que el cobro cubre completas */
  covered: string[]
  /** Ocurrencia que queda abonada, con lo que recibe */
  partial: Allocation | null
  allocations: Allocation[]
  /** Mensaje si sobra monto; null si el reparto cabe */
  error: string | null
}

/** Reparto de `amount` desde la ocurrencia no recibida más antigua */
export function previewIncomeReceipt(
  source: IncomeReceiptPeriods,
  amount: number,
  own: IncomeAllocation[] = []
): IncomeReceiptPreview {
  const periods = withoutOwn(source.periods, own)
  const { allocations, leftover } = allocateOldestFirst(periods, amount)
  const dueByKey = new Map(periods.map((period) => [period.key, period.due]))

  const covered: string[] = []
  let partial: Allocation | null = null
  for (const allocation of allocations) {
    if (allocation.amount < (dueByKey.get(allocation.key) ?? 0)) {
      partial = allocation
    } else {
      covered.push(allocation.key)
    }
  }

  return {
    covered,
    partial,
    allocations,
    error:
      leftover > 0
        ? source.futureLimited
          ? FUTURE_LIMIT_ERROR
          : EXCEEDS_END_ERROR
        : null
  }
}

/**
 * Lo que falta de todas las ocurrencias abiertas hasta `dueOn` (inclusive):
 * el monto que prellena **Recibir** en esa fila
 */
export function amountDueUntil(source: IncomeReceiptPeriods, dueOn: string) {
  const cents = source.periods
    .filter((period) => period.key <= dueOn)
    .reduce((total, period) => total + Math.round(period.due * 100), 0)
  return cents / 100
}

/**
 * Fechas cubiertas como texto: hasta 3, una por una ("sáb 1 nov, sáb 8
 * nov"); más, como rango ("5 ocurrencias, del sáb 1 nov al sáb 29 nov")
 */
export function describeOccurrences(dates: string[]) {
  if (dates.length <= 3) {
    return dates.map(shortOccurrenceDate).join(", ")
  }
  const first = shortOccurrenceDate(dates[0])
  const last = shortOccurrenceDate(dates[dates.length - 1])
  return `${dates.length} ocurrencias, del ${first} al ${last}`
}

/**
 * Resumen sin cifras del reparto que guardó el servidor, para el toast:
 * "Se aplicó a sáb 1 nov, sáb 8 nov". null sin asignaciones.
 */
export function describeSavedReceipt(allocations: IncomeAllocation[]) {
  if (allocations.length === 0) {
    return null
  }
  return `Se aplicó a ${describeOccurrences(allocations.map((item) => item.due_on))}`
}
