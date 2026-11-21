import { format } from "date-fns"
import { es } from "date-fns/locale"

const LOCALE = "es-CO"

// Las fechas usan espacio duro para no partirse en varias líneas
const WHITESPACE = /\s/g

// Monedas que la UI muestra sin decimales, aunque la BD guarde centavos
const ZERO_DECIMAL_CURRENCIES = new Set(["COP", "CLP"])

// `fractionDigits` fuerza los decimales (p. ej. 2 al conciliar, donde importan
// los centavos)
export function formatCurrency(
  amount: number,
  currency = "COP",
  fractionDigits?: number
) {
  const digits =
    fractionDigits ?? (ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2)

  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(amount)
}

// Recibe una fecha `date` de Postgres (YYYY-MM-DD) o un Date. Se formatea en
// UTC para que el día no se corra por la zona horaria del servidor.
export function formatDate(date: string | Date) {
  const value = typeof date === "string" ? new Date(`${date}T00:00:00Z`) : date

  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  })
    .format(value)
    .replace(WHITESPACE, "\u00A0")
}

// Fecha corta sin año ("1 nov") para filas compactas en móvil
export function formatShortDate(date: string | Date) {
  const value = typeof date === "string" ? new Date(`${date}T00:00:00Z`) : date

  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  })
    .format(value)
    .replace(WHITESPACE, "\u00A0")
}

// Hora de un evento ("14:30" o "14:30:00" de Postgres) como "2:30 p. m.". La
// hora es del día del usuario, sin zona: se formatea en UTC para que no se
// corra. Espacio duro para no partirse en varias líneas.
export function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number)
  const value = new Date(Date.UTC(1970, 0, 1, hours, minutes))

  return new Intl.DateTimeFormat(LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC"
  })
    .format(value)
    .replace(WHITESPACE, " ")
}

/**
 * Mes YYYY-MM como "noviembre 2026", en minúscula. Se arma a mediodía local
 * para que la zona horaria no corra el mes.
 */
export function formatMonthYear(month: string) {
  return format(new Date(`${month}-01T12:00:00`), "MMMM yyyy", { locale: es })
}

export interface NumberFormatOptions {
  minimumFractionDigits?: number
  /** Por defecto 3, como `Intl.NumberFormat` */
  maximumFractionDigits?: number
  /** `false` quita el separador de miles (p. ej. tasas en un input) */
  useGrouping?: boolean
}

// Un formateador por combinación de opciones: crearlos es lo costoso
const NUMBER_FORMATS = new Map<string, Intl.NumberFormat>()

/** Número en es-CO sin moneda: 1500000 → "1.500.000", 28.5 → "28,5" */
export function formatNumber(value: number, options: NumberFormatOptions = {}) {
  const key = JSON.stringify(options)
  let format = NUMBER_FORMATS.get(key)
  if (!format) {
    format = new Intl.NumberFormat(LOCALE, options)
    NUMBER_FORMATS.set(key, format)
  }
  return format.format(value)
}

const PERCENT = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  maximumFractionDigits: 1
})

/** Porcentaje en escala 0–100 con un decimal: 12.34 → "12,3 %" */
export function formatPercent(value: number) {
  return PERCENT.format(value / 100)
}

const COMPACT_COUNT = new Intl.NumberFormat(LOCALE, {
  notation: "compact",
  maximumFractionDigits: 1
})

/**
 * Conteo abreviado de Intl (p. ej. estrellas de GitHub): 1234 → "1,2 mil".
 * Los ejes de gráficas usan `formatCompactNumber` de `chart-format.ts`.
 */
export function formatCompactCount(value: number) {
  return COMPACT_COUNT.format(value)
}

const CURRENCY_SYMBOLS = new Map<string, string>()

/** Símbolo corto de la moneda en es-CO ("$" para COP y USD, "€" para EUR) */
export function currencySymbol(currency: string) {
  let symbol = CURRENCY_SYMBOLS.get(currency)
  if (!symbol) {
    symbol =
      new Intl.NumberFormat(LOCALE, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol"
      })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? currency
    CURRENCY_SYMBOLS.set(currency, symbol)
  }
  return symbol
}

// Lo que se muestra en lugar de saldos y totales cuando el usuario oculta las
// cifras (ojo del header)
export const AMOUNT_MASK = "***"
