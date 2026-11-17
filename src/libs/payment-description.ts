// Descripción prellenada de un pago (SPEC 41): `{Verbo} {nombre} · {periodo}`.
// El periodo sale de la frecuencia de la cuota que se paga, no de hoy: un pago
// tardío de octubre dice "octubre". Sin año: la fecha del movimiento ya lo dice;
// el mes basta para distinguir cada cuota

export type PaymentVerb = "Pago" | "Ingreso" | "Cobro"

export type PaymentPeriod =
  /** Cuota mensual: `YYYY-MM-DD` de la cuota */
  | { kind: "month"; on: string }
  /** Cuota quincenal: día 1–15 es la 1.ª quincena, 16 en adelante la 2.ª */
  | { kind: "biweekly"; on: string }
  /** Cuota anual: se nombra por su mes */
  | { kind: "year"; on: string }
  /** Ingreso semanal, diario o cada N días: la fecha de la cuota */
  | { kind: "day"; on: string }
  /**
   * Varias cuotas (SPEC 38/39), de la primera a la última. `unit` dice cómo
   * se nombran: meses (por defecto), días o años
   */
  | { kind: "range"; from: string; to: string; unit?: "month" | "day" | "year" }
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

function dayLabel(value: string) {
  return `${parts(value).day} ${monthName(value, true)}`
}

function periodLabel(period: PaymentPeriod): string | null {
  switch (period.kind) {
    // Una anual también se nombra por su mes
    case "month":
    case "year": {
      return monthName(period.on)
    }
    case "biweekly": {
      const half = parts(period.on).day <= 15 ? "1.ª" : "2.ª"
      return `${half} quincena de ${monthName(period.on)}`
    }
    case "day": {
      return dayLabel(period.on)
    }
    case "range": {
      const from = parts(period.from)
      const to = parts(period.to)
      const sameMonth =
        from.year === to.year && from.monthIndex === to.monthIndex
      if (period.unit === "day") {
        if (period.from === period.to) {
          return dayLabel(period.from)
        }
        // `1 a 29 nov` o `29 nov a 6 dic`
        const start = sameMonth ? String(from.day) : dayLabel(period.from)
        return `${start} a ${dayLabel(period.to)}`
      }
      // Meses o años: `septiembre a noviembre`, `noviembre a enero`
      // Anuales de varios años caen en el mismo mes: `junio`
      if (
        sameMonth ||
        (period.unit === "year" && from.monthIndex === to.monthIndex)
      ) {
        return monthName(period.from)
      }
      return `${monthName(period.from)} a ${monthName(period.to)}`
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
