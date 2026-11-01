const LOCALE = "es-CO"

// Las fechas usan espacio duro para no partirse en varias líneas
const WHITESPACE = /\s/g

// Monedas que la UI muestra sin decimales, aunque la BD guarde centavos
const ZERO_DECIMAL_CURRENCIES = new Set(["COP", "CLP"])

export function formatCurrency(amount: number, currency = "COP") {
  const digits = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2

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
