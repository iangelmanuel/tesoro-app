/** Desde el 80 % el presupuesto está cerca del límite */
export const WARNING_RATIO = 0.8
/** Desde el 100 % el presupuesto está excedido */
export const EXCEEDED_RATIO = 1

/** Estado del presupuesto según lo gastado */
export type BudgetStatus = "ok" | "warning" | "exceeded"

/** Etiqueta de cada estado; "ok" no lleva */
export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string | null> = {
  ok: null,
  warning: "Cerca del límite",
  exceeded: "Excedido"
}

/** Estado según gastado / presupuestado. `committed` no lo cambia. */
export function budgetStatus(spent: number, budget: number): BudgetStatus {
  const ratio = spent / budget
  if (ratio >= EXCEEDED_RATIO) return "exceeded"
  if (ratio >= WARNING_RATIO) return "warning"
  return "ok"
}

/**
 * Porcentaje entero para mostrar. Se trunca para que la etiqueta nunca
 * diga 80 % o 100 % antes de llegar al umbral.
 */
export function budgetPercent(amount: number, budget: number): number {
  return Math.floor((amount / budget) * 100)
}

/**
 * Porcentaje al que llegaría el presupuesto con los pagos pendientes, o
 * null si no hay pendientes o no alcanza el 80 %
 */
export function projectedPercent(
  spent: number,
  committed: number,
  budget: number
): number | null {
  if (committed <= 0 || (spent + committed) / budget < WARNING_RATIO) {
    return null
  }
  return budgetPercent(spent + committed, budget)
}
