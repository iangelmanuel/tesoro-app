// Mecánica común del score de Personal (SPEC 07) y Empresa (SPEC 11): curvas,
// bandas, ventana, semanas y ponderación. Funciones puras; los factores de
// cada espacio viven en su módulo.
import { monthRange, shiftMonth, todayISO } from "@/libs/dates"
import {
  BANDS,
  CLOSED_MONTHS,
  HISTORY_MONTHS,
  MIN_HISTORY_DAYS,
  WINDOW_MONTHS
} from "./constants"
import type { Band, FactorResult, ScoreResult } from "./types"

/** Puntos [dato, puntos] de una curva, con el dato en orden ascendente */
export type Curve = readonly (readonly [number, number])[]

/** Lo mínimo que la ventana y las semanas necesitan de los insumos */
export interface ScoreTimeline {
  /** Hoy en America/Bogota (YYYY-MM-DD) */
  today: string
  firstTransactionOn: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

// Días entre dos fechas YYYY-MM-DD, sin zona horaria de por medio
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)
}

function addDays(date: string, days: number) {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Lunes de la semana ISO de una fecha YYYY-MM-DD */
export function isoWeekStart(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() // 0 = domingo
  return addDays(date, -((weekday + 6) % 7))
}

/** Meses YYYY-MM de `from` a `to`, inclusive; vacío si `from` > `to` */
export function monthsBetween(from: string, to: string) {
  const months: string[] = []
  for (let month = from; month <= to; month = shiftMonth(month, 1)) {
    months.push(month)
  }
  return months
}

/**
 * Interpolación lineal entre los puntos de la curva, con tope en los
 * extremos
 */
export function interpolate(curve: Curve, x: number) {
  const [firstX, firstY] = curve[0]
  const [lastX, lastY] = curve[curve.length - 1]

  if (x <= firstX) return firstY
  if (x >= lastX) return lastY

  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i]
    if (x <= x1) {
      const [x0, y0] = curve[i - 1]
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
    }
  }
  return lastY
}

/** Último día del mes YYYY-MM */
export function monthEnd(month: string) {
  return monthRange(month).to
}

/** Hoy si `month` es el mes actual; si es pasado, su último día */
export function referenceDate(month: string, today = todayISO()) {
  return month === today.slice(0, 7) ? today : monthEnd(month)
}

/**
 * Meses de la ventana: de `max(M − 2, mes del primer movimiento)` a `M`.
 * Vacía sin movimientos o si el primero es posterior a `M`.
 */
export function windowMonths(month: string, firstTransactionOn: string | null) {
  if (firstTransactionOn === null) return []

  const start = shiftMonth(month, -(WINDOW_MONTHS - 1))
  const firstMonth = firstTransactionOn.slice(0, 7)
  return monthsBetween(start > firstMonth ? start : firstMonth, month)
}

/**
 * Los `count` meses anteriores a `M` (3 por defecto), desde el mes del primer
 * movimiento
 */
export function closedMonths(
  month: string,
  firstTransactionOn: string | null,
  count = CLOSED_MONTHS
) {
  if (firstTransactionOn === null) return []

  const firstMonth = firstTransactionOn.slice(0, 7)
  return monthsBetween(shiftMonth(month, -count), shiftMonth(month, -1)).filter(
    (closed) => closed >= firstMonth
  )
}

/**
 * Días que faltan para tener 30 días de registros a la referencia de `M`; 0
 * si ya los hay
 */
export function missingHistoryDays(timeline: ScoreTimeline, month: string) {
  const reference = referenceDate(month, timeline.today)
  const elapsed =
    timeline.firstTransactionOn === null
      ? 0
      : daysBetween(timeline.firstTransactionOn, reference)

  return Math.max(MIN_HISTORY_DAYS - elapsed, 0)
}

/**
 * Semanas ISO (lunes) que tocan `[max(inicio de ventana, primer movimiento),
 * referencia]`
 */
export function windowWeeks(timeline: ScoreTimeline, month: string) {
  const window = windowMonths(month, timeline.firstTransactionOn)
  if (window.length === 0 || timeline.firstTransactionOn === null) return []

  const windowStart = `${window[0]}-01`
  const from =
    windowStart > timeline.firstTransactionOn
      ? windowStart
      : timeline.firstTransactionOn
  const reference = referenceDate(month, timeline.today)

  const weeks: string[] = []
  for (
    let week = isoWeekStart(from);
    week <= reference;
    week = addDays(week, 7)
  ) {
    weeks.push(week)
  }
  return weeks
}

/** Semanas de ventana con ≥ 1 movimiento, y su total */
export function regularityCounts(
  timeline: ScoreTimeline & { activeWeeks: Set<string> },
  month: string
) {
  const weeks = windowWeeks(timeline, month)
  return {
    active: weeks.filter((week) => timeline.activeWeeks.has(week)).length,
    total: weeks.length
  }
}

export function isIncluded<K extends string>(
  factor: FactorResult<K>
): factor is Extract<FactorResult<K>, { points: number }> {
  return "points" in factor
}

/** `round(Σ (peso × puntos) / Σ pesos incluidos)` */
export function weightedScore<K extends string>(factors: FactorResult<K>[]) {
  const parts = factors.filter(isIncluded)
  const weights = parts.reduce((sum, factor) => sum + factor.weight, 0)

  if (weights === 0) return 0
  const total = parts.reduce(
    (sum, factor) => sum + factor.weight * factor.points,
    0
  )
  return Math.min(Math.max(Math.round(total / weights), 0), 100)
}

export function scoreBand(score: number): Band {
  return (BANDS.find((band) => score >= band.min) ?? BANDS[BANDS.length - 1])
    .band
}

export function bandInfo(band: Band) {
  return BANDS.find((item) => item.band === band) ?? BANDS[BANDS.length - 1]
}

export function hasScore<K extends string>(
  result: ScoreResult<K>
): result is Extract<ScoreResult<K>, { score: number }> {
  return "score" in result
}

/** Score de `M` − score de `M − 1`, o null si alguno no tiene score */
export function scoreVariation<K extends string>(
  current: ScoreResult<K>,
  previous: ScoreResult<K>
) {
  if (!hasScore(current) || !hasScore(previous)) return null
  return current.score - previous.score
}

/** Los 12 meses YYYY-MM hasta el actual, del más viejo al más reciente */
export function historyMonths(today = todayISO()) {
  const current = today.slice(0, 7)
  return monthsBetween(shiftMonth(current, -(HISTORY_MONTHS - 1)), current)
}
