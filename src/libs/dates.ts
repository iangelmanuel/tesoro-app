// "Hoy" y "mes actual" se calculan siempre en la zona del producto, no en la
// del servidor ni la del navegador
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

// YYYY-MM-DD ↔ Date local, sin pasar por UTC para no correr el día. Para
// los selectores de fecha (Calendar trabaja con fechas locales).
export function toLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function fromLocalDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}
