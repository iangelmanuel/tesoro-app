import type { OccurrenceTone } from "@/features/recurring-expenses/occurrences"
import type { DebtCalcInput } from "./calculations"

// Utilización del cupo de las tarjetas (SPEC 06): por tarjeta y global

/** Saldo / cupo en porcentaje entero, truncado. Puede pasar de 100. */
export function utilizationPercent(balance: number, creditLimit: number) {
  return Math.max(Math.floor((balance / creditLimit) * 100), 0)
}

export type UtilizationLevel = "healthy" | "moderate" | "high"

export const UTILIZATION_LEVELS: Record<
  UtilizationLevel,
  { label: string; tone: OccurrenceTone }
> = {
  healthy: { label: "Saludable", tone: "success" },
  moderate: { label: "Moderada", tone: "warning" },
  high: { label: "Alta", tone: "danger" }
}

/** Nivel de la utilización: alta desde 70 %, moderada desde 30 % */
export function utilizationLevel(percent: number): UtilizationLevel {
  if (percent >= 70) return "high"
  if (percent >= 30) return "moderate"
  return "healthy"
}

/** Σ saldos / Σ cupos de las tarjetas activas, o null sin tarjetas activas */
export function globalUtilization(debts: DebtCalcInput[]) {
  const cards = debts.filter(
    (debt) =>
      debt.kind === "credit_card" &&
      debt.status === "active" &&
      debt.credit_limit !== null
  )

  if (cards.length === 0) {
    return null
  }

  const balance = cards.reduce((sum, debt) => sum + debt.balance, 0)
  const limit = cards.reduce((sum, debt) => sum + (debt.credit_limit ?? 0), 0)
  return utilizationPercent(balance, limit)
}
