import { formatCurrency } from "@/libs/format"

// Formato y color de la variación vs. el mes anterior en las tarjetas del
// Resumen. Lo comparten Personal y Empresa.

export const EMPTY = "—"
export const POSITIVE = "text-emerald-600 dark:text-emerald-400"
export const NEGATIVE = "text-rose-600 dark:text-rose-400"

export const PERCENT = new Intl.NumberFormat("es-CO", {
  style: "percent",
  maximumFractionDigits: 1
})

const SIGNED_PERCENT = new Intl.NumberFormat("es-CO", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero"
})

/** Variación % con signo, o "—" si no hay base para compararla */
export function formatPercentChange(change: number | null) {
  return change === null ? EMPTY : SIGNED_PERCENT.format(change / 100)
}

export function formatSignedCurrency(amount: number, currency: string) {
  return `${amount > 0 ? "+" : ""}${formatCurrency(amount, currency)}`
}

// Verde si el cambio es bueno y rojo si es malo. En gastos subir es malo.
export function changeTone(change: number | null, inverted = false) {
  if (!change) return "text-muted-foreground"
  return change > 0 !== inverted ? POSITIVE : NEGATIVE
}
