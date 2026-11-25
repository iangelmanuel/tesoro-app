/**
 * "Hoy" y "mes actual" se calculan siempre en la zona del producto, no en la
 * del servidor ni la del navegador
 */
export const TIME_ZONE = "America/Bogota"

const ISO_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
})

/** Fecha de hoy en America/Bogota (YYYY-MM-DD) */
export function todayISO(now = new Date()) {
  return ISO_DATE.format(now)
}

const HOUR = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  hourCycle: "h23"
})

/** Saludo según la hora en America/Bogota: mañana 5–11, tarde 12–18 */
export function greeting(now = new Date()) {
  const hour = Number(HOUR.format(now))
  if (hour >= 5 && hour < 12) return "Buenos días"
  if (hour >= 12 && hour < 19) return "Buenas tardes"
  return "Buenas noches"
}

/** Mes actual en America/Bogota (YYYY-MM) */
export function currentMonth(now = new Date()) {
  return todayISO(now).slice(0, 7)
}

/** Primer y último día de un mes YYYY-MM, como fechas YYYY-MM-DD */
export function monthRange(month: string) {
  const [year, monthIndex] = month.split("-").map(Number)
  const lastDay = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate()

  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`
  }
}

/** Mes YYYY-MM desplazado `delta` meses (negativo hacia atrás) */
export function shiftMonth(month: string, delta: number) {
  const [year, monthIndex] = month.split("-").map(Number)
  const date = new Date(Date.UTC(year, monthIndex - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}

/**
 * YYYY-MM-DD ↔ Date local, sin pasar por UTC para no correr el día. Para
 * los selectores de fecha (Calendar trabaja con fechas locales).
 */
export function toLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

/** Date local → YYYY-MM-DD, sin pasar por UTC (inverso de `toLocalDate`) */
export function fromLocalDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

/** Meses YYYY-MM de `from` a `to`, inclusive; vacío si `from` > `to` */
export function listMonths(from: string, to: string): string[] {
  const months: string[] = []
  for (let month = from; month <= to; month = shiftMonth(month, 1)) {
    months.push(month)
  }
  return months
}

/** Cuántos meses hay de `from` a `to` (YYYY-MM), ambos incluidos */
export function countMonths(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split("-").map(Number)
  const [toYear, toMonth] = to.split("-").map(Number)
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1
}

/** "14:30:00" → "14:30"; sin hora, null */
export function trimSeconds(value: string | null): string | null {
  return value ? value.slice(0, 5) : null
}

/** Suma `days` días (o resta, si es negativo) a una fecha YYYY-MM-DD, en UTC */
export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10)
}
