// Cálculos puros del score sobre insumos ya consultados (SPEC 07). Ninguno
// consulta la BD ni suma movimientos: las sumas vienen de las RPC.
import { goalStatus } from "@/features/goals/progress"
import { monthRange, shiftMonth, todayISO } from "@/libs/dates"
import {
  BANDS,
  CLOSED_MONTHS,
  type Curve,
  EXCLUDED_REASONS,
  FACTORS,
  FACTOR_KEYS,
  HISTORY_MONTHS,
  INSUFFICIENT_REASONS,
  MIN_HISTORY_DAYS,
  WINDOW_MONTHS
} from "./constants"
import type {
  Band,
  FactorKey,
  FactorResult,
  MonthlyInput,
  ScoreDebt,
  ScoreGoal,
  ScoreInputs,
  ScoreResult
} from "./types"

const DAY_MS = 24 * 60 * 60 * 1000

// Días entre dos fechas YYYY-MM-DD, sin zona horaria de por medio
function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)
}

function addDays(date: string, days: number) {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Lunes de la semana ISO de una fecha YYYY-MM-DD */
export function isoWeekStart(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() // 0 = domingo
  return addDays(date, -((weekday + 6) % 7))
}

/** Meses YYYY-MM de `from` a `to`, inclusive; vacío si `from` > `to` */
export function monthsBetween(from: string, to: string) {
  const months: string[] = []
  for (let month = from; month <= to; month = shiftMonth(month, 1)) {
    months.push(month)
  }
  return months
}

/**
 * Interpolación lineal entre los puntos de la curva, con tope en los
 * extremos
 */
export function interpolate(curve: Curve, x: number) {
  const [firstX, firstY] = curve[0]
  const [lastX, lastY] = curve[curve.length - 1]

  if (x <= firstX) return firstY
  if (x >= lastX) return lastY

  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i]
    if (x <= x1) {
      const [x0, y0] = curve[i - 1]
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
    }
  }
  return lastY
}

/** Último día del mes YYYY-MM */
export function monthEnd(month: string) {
  return monthRange(month).to
}

/** Hoy si `month` es el mes actual; si es pasado, su último día */
export function referenceDate(month: string, today = todayISO()) {
  return month === today.slice(0, 7) ? today : monthEnd(month)
}

/** Fecha en America/Bogota (YYYY-MM-DD) de un timestamp */
function localDate(timestamp: string) {
  return todayISO(new Date(timestamp))
}

/**
 * Meses de la ventana: de `max(M − 2, mes del primer movimiento)` a `M`.
 * Vacía sin movimientos o si el primero es posterior a `M`.
 */
export function windowMonths(month: string, firstTransactionOn: string | null) {
  if (firstTransactionOn === null) return []

  const start = shiftMonth(month, -(WINDOW_MONTHS - 1))
  const firstMonth = firstTransactionOn.slice(0, 7)
  return monthsBetween(start > firstMonth ? start : firstMonth, month)
}

/** Los 3 meses anteriores a `M`, desde el mes del primer movimiento */
export function closedMonths(month: string, firstTransactionOn: string | null) {
  if (firstTransactionOn === null) return []

  const firstMonth = firstTransactionOn.slice(0, 7)
  return monthsBetween(
    shiftMonth(month, -CLOSED_MONTHS),
    shiftMonth(month, -1)
  ).filter((closed) => closed >= firstMonth)
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
  const reference = referenceDate(month, inputs.today)

  if (windowTotals(inputs, month).income <= 0) {
    reasons.push(INSUFFICIENT_REASONS.noIncome)
  }

  const elapsed =
    inputs.firstTransactionOn === null
      ? 0
      : daysBetween(inputs.firstTransactionOn, reference)

  if (elapsed < MIN_HISTORY_DAYS) {
    reasons.push(INSUFFICIENT_REASONS.missingDays(MIN_HISTORY_DAYS - elapsed))
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

/**
 * Semanas ISO (lunes) que tocan `[max(inicio de ventana, primer movimiento),
 * referencia]`
 */
export function windowWeeks(inputs: ScoreInputs, month: string) {
  const window = windowMonths(month, inputs.firstTransactionOn)
  if (window.length === 0 || inputs.firstTransactionOn === null) return []

  const windowStart = `${window[0]}-01`
  const from =
    windowStart > inputs.firstTransactionOn
      ? windowStart
      : inputs.firstTransactionOn
  const reference = referenceDate(month, inputs.today)

  const weeks: string[] = []
  for (
    let week = isoWeekStart(from);
    week <= reference;
    week = addDays(week, 7)
  ) {
    weeks.push(week)
  }
  return weeks
}

/** Semanas de ventana con ≥ 1 movimiento, y su total */
export function regularityCounts(inputs: ScoreInputs, month: string) {
  const weeks = windowWeeks(inputs, month)
  return {
    active: weeks.filter((week) => inputs.activeWeeks.has(week)).length,
    total: weeks.length
  }
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

export function isIncluded(
  factor: FactorResult
): factor is Extract<FactorResult, { points: number }> {
  return "points" in factor
}

/** `round(Σ (peso × puntos) / Σ pesos incluidos)` */
export function weightedScore(factors: FactorResult[]) {
  const parts = factors.filter(isIncluded)
  const weights = parts.reduce((sum, factor) => sum + factor.weight, 0)

  if (weights === 0) return 0
  const total = parts.reduce(
    (sum, factor) => sum + factor.weight * factor.points,
    0
  )
  return Math.min(Math.max(Math.round(total / weights), 0), 100)
}

export function scoreBand(score: number): Band {
  return (BANDS.find((band) => score >= band.min) ?? BANDS[BANDS.length - 1])
    .band
}

export function bandInfo(band: Band) {
  return BANDS.find((item) => item.band === band) ?? BANDS[BANDS.length - 1]
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

export function hasScore(
  result: ScoreResult
): result is Extract<ScoreResult, { score: number }> {
  return "score" in result
}

/** Score de `M` − score de `M − 1`, o null si alguno no tiene score */
export function scoreVariation(current: ScoreResult, previous: ScoreResult) {
  if (!hasScore(current) || !hasScore(previous)) return null
  return current.score - previous.score
}

/** Los 12 meses YYYY-MM hasta el actual, del más viejo al más reciente */
export function historyMonths(today = todayISO()) {
  const current = today.slice(0, 7)
  return monthsBetween(shiftMonth(current, -(HISTORY_MONTHS - 1)), current)
}

/** Score de cada uno de los 12 meses hasta el actual */
export function scoreHistory(inputs: ScoreInputs) {
  return historyMonths(inputs.today).map((month) => computeScore(inputs, month))
}
