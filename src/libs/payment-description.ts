// Descripción prellenada de un pago (SPEC 41): `{Verbo} {nombre} · {periodo}`.
// El periodo sale de la frecuencia de la cuota que se paga, no de hoy: un pago
// tardío de octubre dice "octubre"

export type PaymentVerb = "Pago" | "Ingreso" | "Cobro"

export type PaymentPeriod =
  /** Cuota mensual: `YYYY-MM-DD` de la cuota */
  | { kind: "month"; on: string }
  /** Cuota quincenal: día 1–15 es la 1.ª quincena, 16 en adelante la 2.ª */
  | { kind: "biweekly"; on: string }
  | { kind: "year"; on: string }
  /** Varios meses (SPEC 38/39): de la primera a la última cuota */
  | { kind: "range"; from: string; to: string }
  /** Sin frecuencia: cobro único o abono libre a tarjeta o préstamo */
  | { kind: "none" }

// Meses de es-CO en minúscula, fijos para no depender del ICU del entorno
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre"
] as const

function parts(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return { year, monthIndex: month - 1, day }
}

function monthName(value: string, short = false) {
  const name = MONTHS[parts(value).monthIndex]
  return short ? name.slice(0, 3) : name
}

function periodLabel(period: PaymentPeriod): string | null {
  switch (period.kind) {
    case "month": {
      return `${monthName(period.on)} ${parts(period.on).year}`
    }
    case "biweekly": {
      const { year, day } = parts(period.on)
      const half = day <= 15 ? "1.ª" : "2.ª"
      return `${half} quincena de ${monthName(period.on)} ${year}`
    }
    case "year": {
      return String(parts(period.on).year)
    }
    case "range": {
      const from = parts(period.from)
      const to = parts(period.to)
      if (from.year === to.year && from.monthIndex === to.monthIndex) {
        return periodLabel({ kind: "month", on: period.from })
      }
      if (from.year === to.year) {
        return `${monthName(period.from)} a ${monthName(period.to)} ${to.year}`
      }
      // Cruza de año: meses cortos con su año (`nov 2026 a ene 2027`)
      return `${monthName(period.from, true)} ${from.year} a ${monthName(period.to, true)} ${to.year}`
    }
    case "none": {
      return null
    }
  }
}

export function buildPaymentDescription(
  verb: PaymentVerb,
  name: string,
  period: PaymentPeriod
) {
  const label = periodLabel(period)
  const base = `${verb} ${name.trim()}`
  return label ? `${base} · ${label}` : base
}
