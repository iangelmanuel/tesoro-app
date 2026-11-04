// Formato y color de la variación vs. el mes anterior en las tarjetas del
// Resumen. Lo comparten Personal y Empresa.

export const EMPTY = "—"
export const POSITIVE = "text-(--income)"
export const NEGATIVE = "text-(--expense)"

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

// Verde si el cambio es bueno y rojo si es malo. En gastos subir es malo.
export function changeTone(change: number | null, inverted = false) {
  if (!change) return "text-muted"
  return change > 0 !== inverted ? POSITIVE : NEGATIVE
}
