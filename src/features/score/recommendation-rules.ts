// Reglas de recomendación de Personal, sin IA (SPEC 07). Todas se evalúan
// sobre hoy y el mes actual, aunque el score esté "Sin datos suficientes".
// Cada una muestra el dato que la dispara y enlaza a donde se actúa. Puras:
// los datos los consulta getRecommendations (recommendations.ts).
import type { Route } from "next"
import { ACCOUNTS_PATH } from "@/features/accounts/constants"
import type { AccountWithBalance } from "@/features/accounts/types"
import { budgetPercent } from "@/features/budgets/progress"
import type { BudgetProgress } from "@/features/budgets/queries"
import { BUDGETS_PATH, RECURRING_PATH } from "@/features/budgets/tabs"
import {
  DEBTS_PATH,
  formatDayMonth,
  isActiveDebt,
  monthlyInterest,
  monthlyRate,
  nextPayment,
  utilizationPercent
} from "@/features/debts/calculations"
import {
  GOALS_PATH,
  expectedSaved,
  goalStatus
} from "@/features/goals/progress"
import type { UpcomingPayment } from "@/features/recurring-expenses/queries"
import { REPORTS_PATH, buildReportQuery } from "@/features/reports/period"
import type { CategoryTotal } from "@/features/reports/queries"
import { TRANSACTIONS_PATH } from "@/features/transactions/filters"
import { monthRange, shiftMonth } from "@/libs/dates"
import { formatCurrency, formatNumber } from "@/libs/format"
import {
  averageExpense,
  cushionFactor,
  insufficientReasons
} from "./calculations"
import {
  BUDGET_EXCEEDED_RATIO,
  CATEGORY_GROWTH_BASE_MONTHS,
  CATEGORY_GROWTH_MIN_SHARE,
  CATEGORY_GROWTH_RATIO,
  HIGH_UTILIZATION_RATIO,
  LOW_CUSHION_MONTHS,
  TARGET_UTILIZATION_RATIO,
  UNBUDGETED_MIN_CATEGORIES
} from "./constants"
import { isIncluded, regularityCounts } from "./curves"
import type { ScoreData } from "./queries"
import {
  compareRecommendations,
  formatMonthName,
  hasFullMonthsBefore,
  irregularRecordsRecommendation,
  isUnusualGrowth,
  negativeAccountRecommendations
} from "./recommendation-helpers"
import type { Recommendation } from "./types"

/** Datos del mes actual que usan las reglas, además de los del score */
export interface RecommendationInputs {
  score: ScoreData
  /** Gasto por categoría en el último mes cerrado */
  lastClosedCategories: CategoryTotal[]
  /** Gasto por categoría en los 3 meses anteriores al último cerrado */
  baseCategories: CategoryTotal[]
  budgets: BudgetProgress[]
  upcomingPayments: UpcomingPayment[]
  /** Cuentas del espacio con su saldo a hoy, para `negative_account` */
  accounts: AccountWithBalance[]
}

/**
 * Rangos (YYYY-MM-DD) de gasto por categoría que necesita `category_growth`
 * para el mes actual: el último mes cerrado y los 3 anteriores
 */
export function categoryGrowthRanges(month: string) {
  const lastClosed = shiftMonth(month, -1)
  const baseFrom = shiftMonth(lastClosed, -CATEGORY_GROWTH_BASE_MONTHS)
  const baseTo = shiftMonth(lastClosed, -1)

  return {
    last: monthRange(lastClosed),
    base: { from: monthRange(baseFrom).from, to: monthRange(baseTo).to }
  }
}

// 1. Último mes cerrado con gastos > ingresos
function deficitRule(data: ScoreData, month: string): Recommendation[] {
  const lastClosed = shiftMonth(month, -1)
  const row = data.months.find((item) => item.month === lastClosed)

  if (!row || row.expense <= row.income) return []

  const deficit = row.expense - row.income
  return [
    {
      rule: "deficit",
      entityKey: lastClosed,
      severity: "high",
      title: "Gastaste más de lo que ingresaste",
      evidence: `En ${formatMonthName(lastClosed)} gastaste ${formatCurrency(deficit)} más de lo que ingresaste`,
      amount: deficit,
      href: `${REPORTS_PATH}?${buildReportQuery({
        period: "month",
        value: lastClosed,
        type: "expense"
      })}` as Route,
      linkLabel: "Ir a Reportes"
    }
  ]
}

// 2. Categoría que creció ≥ 130 % de su promedio de los 3 meses anteriores
function categoryGrowthRule(
  inputs: RecommendationInputs,
  month: string
): Recommendation[] {
  const lastClosed = shiftMonth(month, -1)
  const monthlyExpense = averageExpense(inputs.score, month)

  // Los 3 meses base tienen que estar completos
  const hasBaseMonths = hasFullMonthsBefore(
    inputs.score.firstTransactionOn,
    lastClosed,
    CATEGORY_GROWTH_BASE_MONTHS
  )
  if (!hasBaseMonths || !monthlyExpense) return []

  const baseById = new Map(
    inputs.baseCategories.map((row) => [row.categoryId, row.total])
  )

  return inputs.lastClosedCategories.flatMap((row) => {
    const average =
      (baseById.get(row.categoryId) ?? 0) / CATEGORY_GROWTH_BASE_MONTHS
    const unusual = isUnusualGrowth(row.total, average, monthlyExpense, {
      ratio: CATEGORY_GROWTH_RATIO,
      minShare: CATEGORY_GROWTH_MIN_SHARE
    })
    if (!unusual) return []

    const growth = Math.round((row.total / average - 1) * 100)
    const query = new URLSearchParams({
      month: lastClosed,
      type: "expense",
      category: row.categoryId
    })

    return {
      rule: "category_growth",
      entityKey: row.categoryId,
      severity: "medium",
      title: `${row.name} subió más de lo usual`,
      evidence: `${row.name}: ${formatCurrency(row.total)} en ${formatMonthName(lastClosed)} vs. ${formatCurrency(average)} de promedio (+${growth} %)`,
      amount: row.total - average,
      href: `${TRANSACTIONS_PATH}?${query.toString()}` as Route,
      linkLabel: "Ir a Movimientos"
    }
  })
}

// 3. Presupuesto del mes actual con gastado ≥ 100 %
function budgetExceededRule(budgets: BudgetProgress[]): Recommendation[] {
  return budgets.flatMap((row) => {
    if (
      row.budgetAmount === null ||
      row.spent / row.budgetAmount < BUDGET_EXCEEDED_RATIO
    ) {
      return []
    }

    return {
      rule: "budget_exceeded",
      entityKey: row.categoryId,
      severity: "high",
      title: `Superaste el presupuesto de ${row.name}`,
      evidence: `${row.name}: gastaste ${formatCurrency(row.spent)} de ${formatCurrency(row.budgetAmount)} (${budgetPercent(row.spent, row.budgetAmount)} %)`,
      amount: row.spent - row.budgetAmount,
      href: BUDGETS_PATH,
      linkLabel: "Ir a Presupuestos"
    }
  })
}

// 4. Meta activa "En riesgo"
function goalAtRiskRule(data: ScoreData): Recommendation[] {
  return data.goals.flatMap((goal) => {
    if (
      goal.target_date === null ||
      goalStatus(goal, data.today) !== "at_risk"
    ) {
      return []
    }

    const expected = expectedSaved(goal, goal.target_date, data.today)
    return {
      rule: "goal_at_risk",
      entityKey: goal.id,
      severity: "medium",
      title: `La meta ${goal.name} va atrasada`,
      evidence: `${goal.name}: llevas ${formatCurrency(goal.saved)}; a hoy deberías llevar ${formatCurrency(expected)}`,
      amount: expected - goal.saved,
      href: GOALS_PATH,
      linkLabel: "Ir a Metas"
    }
  })
}

// 5. Tarjeta activa con utilización ≥ 70 %
function highUtilizationRule(data: ScoreData): Recommendation[] {
  return data.debts.flatMap((debt) => {
    if (
      debt.kind !== "credit_card" ||
      debt.status !== "active" ||
      debt.credit_limit === null ||
      debt.balance / debt.credit_limit < HIGH_UTILIZATION_RATIO
    ) {
      return []
    }

    return {
      rule: "high_utilization",
      entityKey: debt.id,
      severity: "medium",
      title: `Uso alto de la tarjeta ${debt.name}`,
      evidence: `${debt.name}: usas ${utilizationPercent(debt.balance, debt.credit_limit)} % de ${formatCurrency(debt.credit_limit)}`,
      amount: debt.balance - TARGET_UTILIZATION_RATIO * debt.credit_limit,
      href: DEBTS_PATH,
      linkLabel: "Ir a Deudas"
    }
  })
}

// 6. Con ≥ 2 deudas con saldo y tasa, la de mayor tasa mensual
function highestRateFirstRule(data: ScoreData): Recommendation[] {
  const withRate = data.debts.filter(
    (debt) =>
      isActiveDebt(debt) && debt.balance > 0 && (debt.interest_rate ?? 0) > 0
  )

  if (withRate.length < 2) return []

  const rateOf = (debt: (typeof withRate)[number]) =>
    monthlyRate(debt.interest_rate, debt.rate_type)
  const highest = withRate.reduce((best, debt) =>
    rateOf(debt) > rateOf(best) ? debt : best
  )

  return [
    {
      rule: "highest_rate_first",
      entityKey: highest.id,
      severity: "low",
      title: "Abona primero a la deuda más cara",
      evidence: `${highest.name} tiene la tasa más alta (${formatNumber(rateOf(highest) * 100, { maximumFractionDigits: 1 })} % mensual). Abona extra ahí primero`,
      amount: monthlyInterest(highest),
      href: DEBTS_PATH,
      linkLabel: "Ir a Deudas"
    }
  ]
}

// 7. Deuda "Vencida" u ocurrencia de gasto fijo vencida
function overduePaymentRule(inputs: RecommendationInputs): Recommendation[] {
  const debts: Recommendation[] = inputs.score.debts.flatMap((debt) => {
    const payment = nextPayment(debt, inputs.score.today)
    if (payment?.status !== "overdue") return []

    const amount = payment.amount ?? 0
    return {
      rule: "overdue_payment",
      entityKey: `debt:${debt.id}`,
      severity: "high",
      title: `Pago vencido de ${debt.name}`,
      evidence: `${debt.name} venció el ${formatDayMonth(payment.dueOn)} (${formatCurrency(amount)})`,
      amount,
      href: DEBTS_PATH,
      linkLabel: "Ir a Deudas"
    }
  })

  const recurring: Recommendation[] = inputs.upcomingPayments.flatMap(
    (payment) => {
      if (payment.status !== "overdue") return []

      return {
        rule: "overdue_payment",
        entityKey: `recurring:${payment.recurringExpenseId}:${payment.dueOn}`,
        severity: "high",
        title: `Pago vencido de ${payment.name}`,
        evidence: `${payment.name} venció el ${formatDayMonth(payment.dueOn)} (${formatCurrency(payment.amount)})`,
        amount: payment.amount,
        href: RECURRING_PATH as Route,
        linkLabel: "Ir a Gastos fijos"
      }
    }
  )

  return [...debts, ...recurring]
}

// 8. Factor colchón incluido y < 3 meses
function lowCushionRule(data: ScoreData, month: string): Recommendation[] {
  const factor = cushionFactor(data, month)
  const average = averageExpense(data, month)

  if (!isIncluded(factor) || factor.value >= LOW_CUSHION_MONTHS || !average) {
    return []
  }

  const balance = factor.value * average
  return [
    {
      rule: "low_cushion",
      entityKey: "workspace",
      severity: "medium",
      title: "Tu colchón es bajo",
      evidence: `Tu balance cubre ${formatNumber(factor.value, { maximumFractionDigits: 1 })} meses de salidas`,
      amount: LOW_CUSHION_MONTHS * average - balance,
      href: GOALS_PATH,
      linkLabel: "Ir a Metas"
    }
  ]
}

// 9. ≥ 2 categorías con gastos en el mes actual y sin presupuesto
function unbudgetedSpendingRule(budgets: BudgetProgress[]): Recommendation[] {
  const unbudgeted = budgets.filter(
    (row) => row.budgetId === null && row.spent > 0
  )

  if (unbudgeted.length < UNBUDGETED_MIN_CATEGORIES) return []

  const names = unbudgeted.slice(0, 3).map((row) => row.name)
  const list = names.join(", ") + (unbudgeted.length > names.length ? "…" : "")

  return [
    {
      rule: "unbudgeted_spending",
      entityKey: "workspace",
      severity: "low",
      title: "Hay salidas sin presupuesto",
      evidence: `${unbudgeted.length} categorías con salidas este mes no tienen presupuesto: ${list}`,
      amount: unbudgeted.reduce((sum, row) => sum + row.spent, 0),
      href: BUDGETS_PATH,
      linkLabel: "Ir a Presupuestos"
    }
  ]
}

// 10. Regularidad del mes actual < 50 %, solo con datos suficientes
function irregularRecordsRule(
  data: ScoreData,
  month: string
): Recommendation[] {
  if (insufficientReasons(data, month).length > 0) return []
  return irregularRecordsRecommendation(
    regularityCounts(data, month),
    TRANSACTIONS_PATH as Route
  )
}

/** Las 11 reglas sobre el mes actual, ordenadas */
export function buildRecommendations(inputs: RecommendationInputs) {
  const { score } = inputs
  const month = score.today.slice(0, 7)

  return [
    ...deficitRule(score, month),
    ...categoryGrowthRule(inputs, month),
    ...budgetExceededRule(inputs.budgets),
    ...goalAtRiskRule(score),
    ...highUtilizationRule(score),
    ...highestRateFirstRule(score),
    ...overduePaymentRule(inputs),
    ...lowCushionRule(score, month),
    ...unbudgetedSpendingRule(inputs.budgets),
    ...irregularRecordsRule(score, month),
    // 11. Billetera o banco activo con saldo a hoy < 0 (SPEC 21)
    ...negativeAccountRecommendations(inputs.accounts, ACCOUNTS_PATH as Route)
  ].sort(compareRecommendations)
}
