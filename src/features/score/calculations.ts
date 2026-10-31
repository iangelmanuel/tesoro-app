// Cálculos puros del score sobre insumos ya consultados (SPEC 07). Ninguno
// consulta la BD ni suma movimientos: las sumas vienen de las RPC.
import { goalStatus } from "@/features/goals/progress"
import { todayISO } from "@/libs/dates"
import {
  EXCLUDED_REASONS,
  FACTORS,
  FACTOR_KEYS,
  INSUFFICIENT_REASONS
} from "./constants"
import {
  closedMonths,
  historyMonths,
  interpolate,
  missingHistoryDays,
  monthEnd,
  referenceDate,
  regularityCounts,
  scoreBand,
  weightedScore,
  windowMonths
} from "./curves"
import type {
  FactorKey,
  FactorResult,
  MonthlyInput,
  ScoreDebt,
  ScoreGoal,
  ScoreInputs,
  ScoreResult
} from "./types"

/** Fecha en America/Bogota (YYYY-MM-DD) de un timestamp */
function localDate(timestamp: string) {
  return todayISO(new Date(timestamp))
}

function monthInput(inputs: ScoreInputs, month: string): MonthlyInput {
  return (
    inputs.months.find((row) => row.month === month) ?? {
      month,
      income: 0,
      expense: 0,
      closingBalance: 0,
      budgetedCount: 0,
      withinBudgetCount: 0
    }
  )
}

function sumOf(rows: MonthlyInput[], field: "income" | "expense") {
  return rows.reduce((sum, row) => sum + row[field], 0)
}

/** Σ ingresos y Σ gastos de la ventana, e ingreso mensual promedio */
export function windowTotals(inputs: ScoreInputs, month: string) {
  const rows = windowMonths(month, inputs.firstTransactionOn).map((m) =>
    monthInput(inputs, m)
  )
  const income = sumOf(rows, "income")

  return {
    income,
    expense: sumOf(rows, "expense"),
    monthlyIncome: rows.length > 0 ? income / rows.length : 0
  }
}

/** Gasto promedio de los meses cerrados, o null si no hay meses cerrados */
export function averageExpense(inputs: ScoreInputs, month: string) {
  const rows = closedMonths(month, inputs.firstTransactionOn).map((m) =>
    monthInput(inputs, m)
  )
  return rows.length > 0 ? sumOf(rows, "expense") / rows.length : null
}

/** Motivos por los que `M` no tiene score; vacío si tiene datos suficientes */
export function insufficientReasons(inputs: ScoreInputs, month: string) {
  const reasons: string[] = []

  if (windowTotals(inputs, month).income <= 0) {
    reasons.push(INSUFFICIENT_REASONS.noIncome)
  }

  const missingDays = missingHistoryDays(inputs, month)
  if (missingDays > 0) {
    reasons.push(INSUFFICIENT_REASONS.missingDays(missingDays))
  }
  return reasons
}

/**
 * Tarjetas y préstamos con `created_at` ≤ fin de `M`, sin archivar hoy y no
 * pagados antes del fin de `M`
 */
export function consideredDebts(debts: ScoreDebt[], month: string) {
  const end = monthEnd(month)

  return debts.filter(
    (debt) =>
      debt.kind !== "receivable" &&
      debt.status !== "archived" &&
      localDate(debt.created_at) <= end &&
      (debt.closed_at === null || localDate(debt.closed_at) > end)
  )
}

/**
 * Metas con fecha objetivo, `created_at` ≤ fin de `M`, sin archivar hoy y no
 * cumplidas antes del fin de `M`
 */
export function consideredGoals(goals: ScoreGoal[], month: string) {
  const end = monthEnd(month)

  return goals.filter(
    (goal) =>
      goal.target_date !== null &&
      goal.status !== "archived" &&
      localDate(goal.created_at) <= end &&
      (goal.completed_at === null || localDate(goal.completed_at) > end)
  )
}

function balanceKey(id: string, month: string) {
  return `${id}:${month}`
}

/** Cuota o pago mínimo con tope en el saldo al fin de `M`; 0 sin mínimo */
function requiredPaymentAt(
  inputs: ScoreInputs,
  debt: ScoreDebt,
  month: string
) {
  const payment = debt.kind === "loan" ? debt.installment : debt.min_payment
  const balance = inputs.debtBalances.get(balanceKey(debt.id, month)) ?? 0
  return payment === null ? 0 : Math.max(Math.min(payment, balance), 0)
}

function included(key: FactorKey, value: number): FactorResult {
  const { weight, curve } = FACTORS[key]
  return { key, weight, value, points: interpolate(curve, value) }
}

function excluded(key: FactorKey, reason: string): FactorResult {
  return { key, weight: FACTORS[key].weight, excluded: reason }
}

/** `(ingresos − gastos) / ingresos` de la ventana. Exige ingresos > 0. */
export function savingsRateFactor(inputs: ScoreInputs, month: string) {
  const { income, expense } = windowTotals(inputs, month)
  return included("savings_rate", income > 0 ? (income - expense) / income : 0)
}

/** `Σ pago requerido / ingreso mensual`. Sin deudas consideradas → 100. */
export function debtToIncomeFactor(inputs: ScoreInputs, month: string) {
  const debts = consideredDebts(inputs.debts, month)
  const { monthlyIncome } = windowTotals(inputs, month)
  const required = debts.reduce(
    (sum, debt) => sum + requiredPaymentAt(inputs, debt, month),
    0
  )

  if (debts.length === 0 || monthlyIncome <= 0) {
    return included("debt_to_income", 0)
  }
  return included("debt_to_income", required / monthlyIncome)
}

/** `max(closing_balance, 0) / gasto promedio`, en meses */
export function cushionFactor(inputs: ScoreInputs, month: string) {
  const average = averageExpense(inputs, month)

  if (average === null) {
    return excluded("emergency_cushion", EXCLUDED_REASONS.noClosedMonths)
  }
  if (average <= 0) {
    return excluded("emergency_cushion", EXCLUDED_REASONS.noClosedExpense)
  }

  const balance = Math.max(monthInput(inputs, month).closingBalance, 0)
  return included("emergency_cushion", balance / average)
}

/** `within_budget_count / budgeted_count` del mes `M` */
export function budgetsFactor(inputs: ScoreInputs, month: string) {
  const { budgetedCount, withinBudgetCount } = monthInput(inputs, month)

  if (budgetedCount === 0) {
    return excluded("budgets", EXCLUDED_REASONS.noBudgets)
  }
  return included("budgets", withinBudgetCount / budgetedCount)
}

/** `Σ saldos / Σ cupos` de las tarjetas consideradas */
export function cardUtilizationFactor(inputs: ScoreInputs, month: string) {
  const cards = consideredDebts(inputs.debts, month).filter(
    (debt) => debt.kind === "credit_card" && debt.credit_limit !== null
  )

  if (cards.length === 0) {
    return excluded("card_utilization", EXCLUDED_REASONS.noCards)
  }

  const balance = cards.reduce(
    (sum, card) =>
      sum + (inputs.debtBalances.get(balanceKey(card.id, month)) ?? 0),
    0
  )
  const limit = cards.reduce((sum, card) => sum + (card.credit_limit ?? 0), 0)
  return included("card_utilization", balance / limit)
}

/** % de metas consideradas "En camino" a la referencia */
export function goalsFactor(inputs: ScoreInputs, month: string) {
  const goals = consideredGoals(inputs.goals, month)

  if (goals.length === 0) {
    return excluded("goals", EXCLUDED_REASONS.noGoals)
  }

  const reference = referenceDate(month, inputs.today)
  const onTrack = goals.filter(
    (goal) =>
      goalStatus(
        {
          target_amount: goal.target_amount,
          target_date: goal.target_date,
          status: "active",
          created_at: goal.created_at,
          saved: inputs.goalBalances.get(balanceKey(goal.id, month)) ?? 0
        },
        reference
      ) === "on_track"
  ).length

  return included("goals", onTrack / goals.length)
}

/** Semanas con ≥ 1 movimiento / semanas de ventana */
export function regularityFactor(inputs: ScoreInputs, month: string) {
  const { active, total } = regularityCounts(inputs, month)
  return included("regularity", total > 0 ? active / total : 0)
}

const FACTOR_FNS: Record<
  FactorKey,
  (inputs: ScoreInputs, month: string) => FactorResult
> = {
  savings_rate: savingsRateFactor,
  debt_to_income: debtToIncomeFactor,
  emergency_cushion: cushionFactor,
  budgets: budgetsFactor,
  card_utilization: cardUtilizationFactor,
  goals: goalsFactor,
  regularity: regularityFactor
}

/** Score del mes `M` (YYYY-MM) o sus motivos de "Sin datos suficientes" */
export function computeScore(inputs: ScoreInputs, month: string): ScoreResult {
  const reasons = insufficientReasons(inputs, month)

  if (reasons.length > 0) {
    return { month, insufficient: reasons }
  }

  const factors = FACTOR_KEYS.map((key) => FACTOR_FNS[key](inputs, month))
  const score = weightedScore(factors)
  return { month, score, band: scoreBand(score), factors }
}

/** Score de cada uno de los 12 meses hasta el actual */
export function scoreHistory(inputs: ScoreInputs) {
  return historyMonths(inputs.today).map((month) => computeScore(inputs, month))
}
