// Insumos de ejemplo y resúmenes de los tests del score de Personal y de
// Empresa (SPEC 55b)
import type {
  BusinessMonthlyInput,
  CategoryCost
} from "@/features/business-score/types"
import type { MonthlyInput, ScoreResult } from "@/features/score/types"

/** Fila de score_monthly_inputs; sin presupuestos por defecto */
export function monthlyInputFixture(
  month: string,
  income: number,
  expense: number,
  closingBalance: number,
  budgetedCount = 0,
  withinBudgetCount = 0
): MonthlyInput {
  return {
    month,
    income,
    expense,
    closingBalance,
    budgetedCount,
    withinBudgetCount
  }
}

/** Mes de Empresa: mes, ventas, costos, saldo en cuentas y nómina */
export type BusinessMonthRow = [string, number, number, number, number]

/** Arriendo fijo de cada mes en los costos por categoría */
const RENT = 2_000_000

/** Costos de un mes: nómina, arriendo y el resto en insumos */
function categoryCostsOf(
  month: string,
  payroll: number,
  costs: number
): CategoryCost[] {
  return [
    { month, categoryId: "payroll", name: "Nómina", total: payroll },
    { month, categoryId: "rent", name: "Arriendo", total: RENT },
    {
      month,
      categoryId: "supplies",
      name: "Insumos",
      total: costs - payroll - RENT
    }
  ]
}

/** `months` y `categoryCosts` de los insumos de Empresa desde una tabla */
export function businessMonthsFixture(rows: BusinessMonthRow[]): {
  months: BusinessMonthlyInput[]
  categoryCosts: CategoryCost[]
} {
  return {
    months: rows.map(([month, sales, costs, accountsBalance]) => ({
      month,
      sales,
      costs,
      accountsBalance
    })),
    categoryCosts: rows.flatMap(([month, , costs, , payroll]) =>
      categoryCostsOf(month, payroll, costs)
    )
  }
}

/** Score y factores en una línea cada uno: clave, peso, dato y puntos */
export function summarizeScore<K extends string>(result: ScoreResult<K>) {
  if (!("score" in result)) return result
  return {
    month: result.month,
    score: result.score,
    band: result.band,
    factors: result.factors.map((factor) =>
      "points" in factor
        ? `${factor.key} ×${factor.weight}: ${factor.value} → ${factor.points}`
        : `${factor.key} ×${factor.weight}: ${factor.excluded}`
    )
  }
}

/** "2026-06: 66 (good)" o "2025-08: motivo / motivo" */
export function historyLine<K extends string>(result: ScoreResult<K>) {
  return "score" in result
    ? `${result.month}: ${result.score} (${result.band})`
    : `${result.month}: ${result.insufficient.join(" / ")}`
}

/** Un negocio de ejemplo de sep. 2025 a jun. 2026 */
export const BUSINESS_MONTHS: BusinessMonthRow[] = [
  // mes, ventas, costos, saldo en cuentas, nómina
  ["2025-09", 9_000_000, 7_000_000, 4_000_000, 3_000_000],
  ["2025-10", 9_500_000, 7_500_000, 5_000_000, 3_000_000],
  ["2025-11", 10_000_000, 8_000_000, 6_000_000, 3_500_000],
  ["2025-12", 12_000_000, 10_500_000, 7_000_000, 4_500_000],
  ["2026-01", 8_000_000, 8_500_000, 6_500_000, 4_000_000],
  ["2026-02", 10_000_000, 8_000_000, 7_500_000, 4_000_000],
  ["2026-03", 11_000_000, 8_500_000, 8_500_000, 4_000_000],
  ["2026-04", 12_000_000, 9_000_000, 9_000_000, 4_000_000],
  ["2026-05", 8_000_000, 9_000_000, 7_000_000, 6_000_000],
  ["2026-06", 4_000_000, 5_000_000, 3_000_000, 3_000_000]
]
