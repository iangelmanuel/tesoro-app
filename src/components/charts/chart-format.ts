// Formato de montos para ejes de gráficas: abreviados y en es-CO
// ($ 1,2 M, $ 350 k). El tooltip y las tablas muestran el monto completo
// con formatCurrency.
import { AMOUNT_MASK } from "@/libs/format"

const LOCALE = "es-CO"

const DECIMAL = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 })

const SYMBOLS = new Map<string, string>()

/** Símbolo corto de la moneda en es-CO ("$" para COP, "US$" para USD…) */
function currencySymbol(currency: string) {
  let symbol = SYMBOLS.get(currency)
  if (!symbol) {
    symbol =
      new Intl.NumberFormat(LOCALE, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol"
      })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? currency
    SYMBOLS.set(currency, symbol)
  }
  return symbol
}

const STEPS = [
  { value: 1e9, suffix: " mil M" },
  { value: 1e6, suffix: " M" },
  { value: 1e3, suffix: " k" }
] as const

/** Número abreviado sin moneda: 1.250.000 → "1,3 M", 350.000 → "350 k" */
export function formatCompactNumber(value: number) {
  const abs = Math.abs(value)
  const step = STEPS.find((entry) => abs >= entry.value)
  if (!step) return DECIMAL.format(value)
  return `${DECIMAL.format(value / step.value)}${step.suffix}`
}

/** Monto abreviado para ticks de eje: "$ 1,2 M", "$ 350 k", "-$ 80 k" */
export function formatCompactCurrency(value: number, currency = "COP") {
  const sign = value < 0 ? "-" : ""
  return `${sign}${currencySymbol(currency)} ${formatCompactNumber(Math.abs(value))}`
}

/**
 * Valor de eje, etiqueta o tooltip con la opción de ocultar cifras: devuelve
 * la máscara si `hidden`, o el monto abreviado. Las gráficas lo llaman en sus
 * funciones de formato, que Recharts ejecuta fuera del árbol normal de React.
 */
export function formatChartAmount(
  value: number,
  currency = "COP",
  hidden = false
) {
  return hidden ? AMOUNT_MASK : formatCompactCurrency(value, currency)
}
