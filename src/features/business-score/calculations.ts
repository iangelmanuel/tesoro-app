// Cálculos puros del score de Empresa (SPEC 11) sobre insumos ya consultados.
// La mecánica (curvas, bandas, ventana, semanas) es la de Personal.
import { INSUFFICIENT_REASONS } from "@/features/score/constants"
import {
  closedMonths,
  historyMonths,
  interpolate,
  missingHistoryDays,
  regularityCounts,
  scoreBand,
  weightedScore,
  windowMonths
} from "@/features/score/curves"
import { shiftMonth } from "@/libs/dates"
import {
  BUSINESS_EXCLUDED_REASONS,
  BUSINESS_FACTORS,
  BUSINESS_FACTOR_KEYS,
  BUSINESS_INSUFFICIENT_REASONS,
  GROWTH_CLOSED_MONTHS,
  PROFITABLE_CLOSED_MONTHS,
  QUARTER_MONTHS
} from "./constants"
import type {
  BusinessFactorKey,
  BusinessFactorResult,
  BusinessMonthlyInput,
  BusinessScoreInputs,
  BusinessScoreResult
} from "./types"

export function monthInput(
  inputs: BusinessScoreInputs,
  month: string
): BusinessMonthlyInput {
  return (
    inputs.months.find((row) => row.month === month) ?? {
      month,
      sales: 0,
      costs: 0,
      accountsBalance: 0
    }
  )
}

function sumOf(rows: BusinessMonthlyInput[], field: "sales" | "costs") {
  return rows.reduce((sum, row) => sum + row[field], 0)
}

function rowsOf(inputs: BusinessScoreInputs, months: string[]) {
  return months.map((month) => monthInput(inputs, month))
}

/** Σ ventas y Σ costos de la ventana de `M` */
export function windowTotals(inputs: BusinessScoreInputs, month: string) {
  const rows = rowsOf(inputs, windowMonths(month, inputs.firstTransactionOn))
  return { sales: sumOf(rows, "sales"), costs: sumOf(rows, "costs") }
}

/** Costo promedio de los meses cerrados (hasta 3), o null si no hay */
export function averageCost(inputs: BusinessScoreInputs, month: string) {
  const rows = rowsOf(inputs, closedMonths(month, inputs.firstTransactionOn))
  return rows.length > 0 ? sumOf(rows, "costs") / rows.length : null
}

/**
 * Categoría con más costo en la ventana de `M` y su parte de los costos de
 * la ventana, o null si la ventana no tiene costos
 */
export function topCostCategory(inputs: BusinessScoreInputs, month: string) {
  const window = new Set(windowMonths(month, inputs.firstTransactionOn))
  const { costs } = windowTotals(inputs, month)
  if (costs <= 0) return null

  const byCategory = new Map<string, { name: string; total: number }>()
  for (const row of inputs.categoryCosts) {
    if (!window.has(row.month)) continue
    const current = byCategory.get(row.categoryId)
    byCategory.set(row.categoryId, {
      name: row.name,
      total: (current?.total ?? 0) + row.total
    })
  }

  let top: { categoryId: string; name: string; total: number } | null = null
  for (const [categoryId, category] of byCategory) {
    if (!top || category.total > top.total) top = { categoryId, ...category }
  }
  return top ? { ...top, share: top.total / costs } : null
}

/** Motivos por los que `M` no tiene score; vacío si tiene datos suficientes */
export function insufficientReasons(
  inputs: BusinessScoreInputs,
  month: string
) {
  const reasons: string[] = []

  if (windowTotals(inputs, month).sales <= 0) {
    reasons.push(BUSINESS_INSUFFICIENT_REASONS.noSales)
  }

  const missingDays = missingHistoryDays(inputs, month)
  if (missingDays > 0) {
    reasons.push(INSUFFICIENT_REASONS.missingDays(missingDays))
  }
  return reasons
}

function included(key: BusinessFactorKey, value: number): BusinessFactorResult {
  const { weight, curve } = BUSINESS_FACTORS[key]
  return { key, weight, value, points: interpolate(curve, value) }
}

function excluded(
  key: BusinessFactorKey,
  reason: string
): BusinessFactorResult {
  return { key, weight: BUSINESS_FACTORS[key].weight, excluded: reason }
}

/** `(ventas − costos) / ventas` de la ventana. Exige ventas > 0. */
export function netMarginFactor(inputs: BusinessScoreInputs, month: string) {
  const { sales, costs } = windowTotals(inputs, month)
  return included("net_margin", sales > 0 ? (sales - costs) / sales : 0)
}

/** `max(saldo en cuentas al fin de M, 0) / costo promedio`, en meses */
export function liquidityFactor(inputs: BusinessScoreInputs, month: string) {
  const average = averageCost(inputs, month)

  if (average === null) {
    return excluded("liquidity", BUSINESS_EXCLUDED_REASONS.noClosedMonths)
  }
  if (average <= 0) {
    return excluded("liquidity", BUSINESS_EXCLUDED_REASONS.noClosedCosts)
  }

  const balance = Math.max(monthInput(inputs, month).accountsBalance, 0)
  return included("liquidity", balance / average)
}

/**
 * `(ventas del trimestre reciente − previo) / ventas del previo`. El reciente
 * son los 3 meses cerrados antes de `M`; el previo, los 3 anteriores.
 */
export function salesGrowthFactor(inputs: BusinessScoreInputs, month: string) {
  const closed = closedMonths(
    month,
    inputs.firstTransactionOn,
    GROWTH_CLOSED_MONTHS
  )

  if (closed.length < GROWTH_CLOSED_MONTHS) {
    return excluded("sales_growth", BUSINESS_EXCLUDED_REASONS.fewClosedMonths)
  }

  const previous = sumOf(
    rowsOf(inputs, closed.slice(0, QUARTER_MONTHS)),
    "sales"
  )
  const recent = sumOf(rowsOf(inputs, closed.slice(QUARTER_MONTHS)), "sales")

  if (previous <= 0) {
    return excluded("sales_growth", BUSINESS_EXCLUDED_REASONS.noPreviousSales)
  }
  return included("sales_growth", (recent - previous) / previous)
}

/** % de los meses cerrados del año (hasta 6) con ventas > costos */
export function profitableMonthsFactor(
  inputs: BusinessScoreInputs,
  month: string
) {
  const rows = rowsOf(
    inputs,
    closedMonths(month, inputs.firstTransactionOn, PROFITABLE_CLOSED_MONTHS)
  )

  if (rows.length === 0) {
    return excluded(
      "profitable_months",
      BUSINESS_EXCLUDED_REASONS.noClosedMonths
    )
  }

  const profitable = rows.filter((row) => row.sales > row.costs).length
  return included("profitable_months", profitable / rows.length)
}

/** % de los costos de la ventana en la categoría de mayor costo */
export function costConcentrationFactor(
  inputs: BusinessScoreInputs,
  month: string
) {
  const top = topCostCategory(inputs, month)

  if (!top) {
    return excluded(
      "cost_concentration",
      BUSINESS_EXCLUDED_REASONS.noWindowCosts
    )
  }
  return included("cost_concentration", top.share)
}

/** Semanas con ≥ 1 movimiento / semanas de ventana */
export function regularityFactor(inputs: BusinessScoreInputs, month: string) {
  const { active, total } = regularityCounts(inputs, month)
  return included("regularity", total > 0 ? active / total : 0)
}

const FACTOR_FNS: Record<
  BusinessFactorKey,
  (inputs: BusinessScoreInputs, month: string) => BusinessFactorResult
> = {
  net_margin: netMarginFactor,
  liquidity: liquidityFactor,
  sales_growth: salesGrowthFactor,
  profitable_months: profitableMonthsFactor,
  cost_concentration: costConcentrationFactor,
  regularity: regularityFactor
}

/** Score del mes `M` (YYYY-MM) o sus motivos de "Sin datos suficientes" */
export function computeBusinessScore(
  inputs: BusinessScoreInputs,
  month: string
): BusinessScoreResult {
  const reasons = insufficientReasons(inputs, month)

  if (reasons.length > 0) {
    return { month, insufficient: reasons }
  }

  const factors = BUSINESS_FACTOR_KEYS.map((key) =>
    FACTOR_FNS[key](inputs, month)
  )
  const score = weightedScore(factors)
  return { month, score, band: scoreBand(score), factors }
}

/** Score de cada uno de los 12 meses hasta el actual */
export function businessScoreHistory(inputs: BusinessScoreInputs) {
  return historyMonths(inputs.today).map((month) =>
    computeBusinessScore(inputs, month)
  )
}

/** Primer mes (YYYY-MM) que necesitan los insumos para calcular desde `from` */
export function businessInputsStart(from: string) {
  return shiftMonth(from, -GROWTH_CLOSED_MONTHS)
}
