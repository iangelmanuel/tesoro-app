// Reglas de recomendación de Empresa (SPEC 11). Se evalúan sobre hoy y el mes
// actual, aunque el score esté "Sin datos suficientes". Puras: los datos los
// consulta getBusinessRecommendations (recommendations.ts).
import type { Route } from "next"
import type { AccountWithBalance } from "@/features/accounts/types"
import { buildReportQuery } from "@/features/reports/period"
import { ENTITY_KEY_MAX } from "@/features/score/constants"
import { isIncluded, regularityCounts } from "@/features/score/curves"
import {
  RATIO_EPSILON,
  compareRecommendations,
  formatMonthName,
  hasFullMonthsBefore,
  irregularRecordsRecommendation,
  isUnusualGrowth,
  negativeAccountRecommendations
} from "@/features/score/recommendation-helpers"
import { buildFiltersQuery } from "@/features/transactions/filters"
import type { TransactionTotals } from "@/features/transactions/types"
import {
  workspaceBasePath,
  workspaceCashFlowPath,
  workspaceReportsPath,
  workspaceTransactionsPath
} from "@/features/workspaces/paths"
import type { Workspace } from "@/features/workspaces/queries"
import { shiftMonth } from "@/libs/dates"
import { formatCurrency, formatNumber } from "@/libs/format"
import {
  averageCost,
  insufficientReasons,
  liquidityFactor,
  monthInput,
  topCostCategory,
  windowTotals
} from "./calculations"
import {
  CLIENT_CONCENTRATION_RATIO,
  COST_CONCENTRATION_RATIO,
  COST_GROWTH_BASE_MONTHS,
  COST_GROWTH_MIN_SHARE,
  COST_GROWTH_RATIO,
  LOW_LIQUIDITY_MONTHS,
  LOW_MARGIN_RATIO,
  MISSING_ACCOUNTS_RATIO,
  SALES_DROP_BASE_MONTHS,
  SALES_DROP_RATIO
} from "./constants"
import type { CounterpartyTotal } from "./queries"
import type { BusinessRecommendation, BusinessScoreInputs } from "./types"

/** Lo que las reglas necesitan del espacio */
export type RuleWorkspace = Pick<Workspace, "id" | "type" | "currency">

/** Datos de hoy y del mes actual que usan las reglas, además del score */
export interface BusinessRecommendationInputs {
  workspace: RuleWorkspace
  score: BusinessScoreInputs
  /** Cuentas del espacio con su saldo a hoy */
  accounts: AccountWithBalance[]
  /** Ventas de la ventana por cliente, de mayor a menor */
  salesByClient: CounterpartyTotal[]
  /** Ventas y costos del mes actual */
  monthTotals: TransactionTotals
  /** Ventas y costos del mes actual sin cuenta */
  withoutAccountTotals: TransactionTotals
}

/** Porcentaje entero con signo tipográfico: "+30 %" o "−30 %" */
function signedPercent(ratio: number) {
  const value = Math.round(ratio * 100)
  return `${value < 0 ? "−" : "+"}${Math.abs(value)} %`
}

/** Porcentaje con hasta un decimal: "8,5 %" */
function percent(ratio: number) {
  return `${formatNumber(ratio * 100, { maximumFractionDigits: 1 })} %`
}

/** Reportes del espacio en el mes YYYY-MM */
function monthReportHref(
  workspace: RuleWorkspace,
  month: string,
  type: "income" | "expense"
) {
  return `${workspaceReportsPath(workspace)}?${buildReportQuery({
    period: "month",
    value: month,
    type
  })}` as Route
}

// 1. Último mes cerrado con costos > ventas
function lossMonthRule(
  inputs: BusinessRecommendationInputs,
  month: string
): BusinessRecommendation[] {
  const { workspace, score } = inputs
  const lastClosed = shiftMonth(month, -1)
  const row = monthInput(score, lastClosed)

  if (row.costs <= row.sales) return []

  const loss = row.costs - row.sales
  return [
    {
      rule: "loss_month",
      entityKey: lastClosed,
      severity: "high",
      title: "Tus salidas superaron tus entradas",
      evidence: `En ${formatMonthName(lastClosed)} tus salidas superaron tus entradas en ${formatCurrency(loss, workspace.currency)}`,
      amount: loss,
      href: monthReportHref(workspace, lastClosed, "expense"),
      linkLabel: "Ir a Reportes"
    }
  ]
}

// 3. Factor liquidez incluido en el mes actual y < 1 mes
function lowLiquidityRule(
  inputs: BusinessRecommendationInputs,
  month: string
): BusinessRecommendation[] {
  const { workspace, score } = inputs
  const factor = liquidityFactor(score, month)
  const average = averageCost(score, month)

  if (!isIncluded(factor) || factor.value >= LOW_LIQUIDITY_MONTHS || !average) {
    return []
  }

  const balance = factor.value * average
  return [
    {
      rule: "low_liquidity",
      entityKey: "workspace",
      severity: "high",
      title: "Tu liquidez es baja",
      evidence: `Tu saldo en cuentas cubre ${formatNumber(factor.value, { maximumFractionDigits: 1 })} meses de salidas`,
      amount: LOW_LIQUIDITY_MONTHS * average - balance,
      href: workspaceCashFlowPath(workspace) as Route,
      linkLabel: "Ir a Flujo de caja"
    }
  ]
}

// 4. Ventas del último mes cerrado ≤ 80 % del promedio de los 3 anteriores
function salesDropRule(
  inputs: BusinessRecommendationInputs,
  month: string
): BusinessRecommendation[] {
  const { workspace, score } = inputs
  const lastClosed = shiftMonth(month, -1)

  // Tiene que haber 3 meses cerrados antes del último cerrado
  const firstMonth = score.firstTransactionOn?.slice(0, 7)
  const baseFrom = shiftMonth(lastClosed, -SALES_DROP_BASE_MONTHS)
  if (!firstMonth || firstMonth > baseFrom) return []

  const base = Array.from({ length: SALES_DROP_BASE_MONTHS }, (_, index) =>
    monthInput(score, shiftMonth(baseFrom, index))
  )
  const average =
    base.reduce((sum, row) => sum + row.sales, 0) / SALES_DROP_BASE_MONTHS
  const sales = monthInput(score, lastClosed).sales

  if (average <= 0 || sales > average * SALES_DROP_RATIO + RATIO_EPSILON) {
    return []
  }

  return [
    {
      rule: "sales_drop",
      entityKey: lastClosed,
      severity: "medium",
      title: "Tus entradas bajaron",
      evidence: `Vendiste ${formatCurrency(sales, workspace.currency)} en ${formatMonthName(lastClosed)} vs. ${formatCurrency(average, workspace.currency)} de promedio (${signedPercent(sales / average - 1)})`,
      amount: average - sales,
      href: monthReportHref(workspace, lastClosed, "income"),
      linkLabel: "Ir a Reportes"
    }
  ]
}

// 5. Margen neto de la ventana < 10 %
function lowMarginRule(
  inputs: BusinessRecommendationInputs,
  month: string
): BusinessRecommendation[] {
  const { workspace, score } = inputs
  const { sales, costs } = windowTotals(score, month)

  if (sales <= 0) return []

  const profit = sales - costs
  const margin = profit / sales
  if (margin >= LOW_MARGIN_RATIO) return []

  return [
    {
      rule: "low_margin",
      entityKey: "workspace",
      severity: "medium",
      title: "Tu margen es bajo",
      evidence: `Tu margen de los últimos 3 meses es ${percent(margin)}`,
      amount: LOW_MARGIN_RATIO * sales - profit,
      href: workspaceReportsPath(workspace) as Route,
      linkLabel: "Ir a Reportes"
    }
  ]
}

// 6. Categoría de costo que creció ≥ 130 % de su promedio de los 3 meses
// anteriores, con una diferencia ≥ 5 % del costo promedio
function costGrowthRule(
  inputs: BusinessRecommendationInputs,
  month: string
): BusinessRecommendation[] {
  const { workspace, score } = inputs
  const lastClosed = shiftMonth(month, -1)
  const monthlyCost = averageCost(score, month)

  // Los 3 meses base tienen que estar completos
  const hasBaseMonths = hasFullMonthsBefore(
    score.firstTransactionOn,
    lastClosed,
    COST_GROWTH_BASE_MONTHS
  )
  if (!hasBaseMonths || !monthlyCost) return []

  const baseMonths = new Set(
    Array.from({ length: COST_GROWTH_BASE_MONTHS }, (_, index) =>
      shiftMonth(lastClosed, -(index + 1))
    )
  )
  const baseById = new Map<string, number>()
  for (const row of score.categoryCosts) {
    if (!baseMonths.has(row.month)) continue
    baseById.set(
      row.categoryId,
      (baseById.get(row.categoryId) ?? 0) + row.total
    )
  }

  return score.categoryCosts.flatMap((row) => {
    if (row.month !== lastClosed) return []

    const average =
      (baseById.get(row.categoryId) ?? 0) / COST_GROWTH_BASE_MONTHS
    const unusual = isUnusualGrowth(row.total, average, monthlyCost, {
      ratio: COST_GROWTH_RATIO,
      minShare: COST_GROWTH_MIN_SHARE
    })
    if (!unusual) return []

    const query = buildFiltersQuery({
      month: lastClosed,
      type: "expense",
      categoryId: row.categoryId,
      page: 1
    })

    return {
      rule: "cost_growth",
      entityKey: row.categoryId,
      severity: "medium",
      title: `${row.name} subió más de lo usual`,
      evidence: `${row.name}: ${formatCurrency(row.total, workspace.currency)} en ${formatMonthName(lastClosed)} vs. ${formatCurrency(average, workspace.currency)} de promedio (${signedPercent(row.total / average - 1)})`,
      amount: row.total - average,
      href: `${workspaceTransactionsPath(workspace)}?${query}` as Route,
      linkLabel: "Ir a Movimientos"
    }
  })
}

// 7. Un cliente suma ≥ 50 % de las ventas de la ventana
function clientConcentrationRule(
  inputs: BusinessRecommendationInputs,
  month: string
): BusinessRecommendation[] {
  const { workspace, score } = inputs
  const { sales } = windowTotals(score, month)

  if (sales <= 0) return []

  return inputs.salesByClient.flatMap((client) => {
    const share = client.total / sales
    if (share < CLIENT_CONCENTRATION_RATIO - RATIO_EPSILON) return []

    const name = client.counterparty.trim()
    const query = buildFiltersQuery({
      month: "all",
      type: "income",
      q: name,
      page: 1
    })

    return {
      rule: "client_concentration",
      entityKey: name.toLowerCase().slice(0, ENTITY_KEY_MAX),
      severity: "medium",
      title: `Dependes mucho de ${name}`,
      evidence: `${name} es el ${Math.round(share * 100)} % de tus entradas de los últimos 3 meses`,
      amount: client.total,
      href: `${workspaceTransactionsPath(workspace)}?${query}` as Route,
      linkLabel: "Ir a Movimientos"
    }
  })
}

// 8. Una categoría suma ≥ 50 % de los costos de la ventana
function costConcentrationRule(
  inputs: BusinessRecommendationInputs,
  month: string
): BusinessRecommendation[] {
  const { workspace, score } = inputs
  const top = topCostCategory(score, month)

  if (!top || top.share < COST_CONCENTRATION_RATIO - RATIO_EPSILON) return []

  return [
    {
      rule: "cost_concentration",
      entityKey: top.categoryId,
      severity: "low",
      title: `${top.name} concentra tus salidas`,
      evidence: `${top.name} es el ${Math.round(top.share * 100)} % de tus salidas de los últimos 3 meses`,
      amount: top.total,
      href: `${workspaceReportsPath(workspace)}?type=expense` as Route,
      linkLabel: "Ir a Reportes"
    }
  ]
}

// 9. ≥ 30 % del monto del mes actual sin cuenta
function missingAccountsRule(
  inputs: BusinessRecommendationInputs,
  month: string
): BusinessRecommendation[] {
  const { workspace, monthTotals, withoutAccountTotals } = inputs
  const total = monthTotals.income + monthTotals.expense
  const withoutAccount =
    withoutAccountTotals.income + withoutAccountTotals.expense

  if (total <= 0) return []

  const share = withoutAccount / total
  if (share < MISSING_ACCOUNTS_RATIO - RATIO_EPSILON) return []

  const query = buildFiltersQuery({ month, accountId: "none", page: 1 })
  return [
    {
      rule: "missing_accounts",
      entityKey: "workspace",
      severity: "low",
      title: "Hay movimientos sin cuenta",
      evidence: `El ${Math.round(share * 100)} % de lo que registraste este mes no tiene cuenta`,
      amount: withoutAccount,
      href: `${workspaceTransactionsPath(workspace)}?${query}` as Route,
      linkLabel: "Ir a Movimientos"
    }
  ]
}

// 10. Regularidad del mes actual < 50 %, solo con datos suficientes. Misma
// regla y texto que Personal
function irregularRecordsRule(
  inputs: BusinessRecommendationInputs,
  month: string
): BusinessRecommendation[] {
  const { workspace, score } = inputs
  if (insufficientReasons(score, month).length > 0) return []
  return irregularRecordsRecommendation(
    regularityCounts(score, month),
    workspaceTransactionsPath(workspace) as Route
  )
}

/** Las 10 reglas sobre el mes actual, ordenadas */
export function buildBusinessRecommendations(
  inputs: BusinessRecommendationInputs
) {
  const month = inputs.score.today.slice(0, 7)

  return [
    ...lossMonthRule(inputs, month),
    // 2. Billetera o banco activo con saldo a hoy < 0 (isNegativeAccount)
    ...negativeAccountRecommendations(
      inputs.accounts,
      `${workspaceBasePath(inputs.workspace)}/accounts` as Route,
      inputs.workspace.currency
    ),
    ...lowLiquidityRule(inputs, month),
    ...salesDropRule(inputs, month),
    ...lowMarginRule(inputs, month),
    ...costGrowthRule(inputs, month),
    ...clientConcentrationRule(inputs, month),
    ...costConcentrationRule(inputs, month),
    ...missingAccountsRule(inputs, month),
    ...irregularRecordsRule(inputs, month)
  ].sort(compareRecommendations)
}
