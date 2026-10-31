import { type Debt, getDebts } from "@/features/debts/queries"
import { type Goal, getGoals } from "@/features/goals/queries"
import { shiftMonth, todayISO } from "@/libs/dates"
import { createClient } from "@/libs/supabase/server"
import { scoreHistory } from "./calculations"
import { CLOSED_MONTHS } from "./constants"
import { historyMonths } from "./curves"
import type { MonthlyInput, RuleKey, ScoreInputs } from "./types"

// Las sumas corren en Postgres (RPC security invoker, con RLS) y el score se
// calcula en TS. `numeric` puede llegar como string: se convierte con
// Number() aquí.

export type ScoreData = Omit<ScoreInputs, "debts" | "goals"> & {
  debts: Debt[]
  goals: Goal[]
}

/** Fecha del primer movimiento del espacio, o null si no hay */
export async function getFirstTransactionOn(workspaceId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("transactions")
    .select("occurred_on")
    .eq("workspace_id", workspaceId)
    .order("occurred_on", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error("No se pudo consultar el primer movimiento")
  }

  return data?.occurred_on ?? null
}

/**
 * Insumos para calcular el score de los meses `from` a `to` (YYYY-MM). Las
 * RPC empiezan 3 meses antes de `from` para cubrir la ventana y los meses
 * cerrados del primer mes.
 */
export async function getScoreInputs(
  workspaceId: string,
  from: string,
  to: string,
  today = todayISO()
): Promise<ScoreData> {
  const supabase = await createClient()
  const range = {
    p_workspace_id: workspaceId,
    p_from: `${shiftMonth(from, -CLOSED_MONTHS)}-01`,
    p_to: `${to}-01`
  }

  const [monthly, weekly, balances, debts, goals, firstTransactionOn] =
    await Promise.all([
      supabase.rpc("score_monthly_inputs", range),
      supabase.rpc("score_weekly_activity", range),
      supabase.rpc("score_balances", range),
      getDebts(workspaceId),
      getGoals(workspaceId),
      getFirstTransactionOn(workspaceId)
    ])

  if (monthly.error || weekly.error || balances.error) {
    throw new Error("No se pudieron calcular los insumos del score")
  }

  const months: MonthlyInput[] = monthly.data.map((row) => ({
    month: row.month.slice(0, 7),
    income: Number(row.income),
    expense: Number(row.expense),
    closingBalance: Number(row.closing_balance),
    budgetedCount: Number(row.budgeted_count),
    withinBudgetCount: Number(row.within_budget_count)
  }))

  const debtBalances = new Map<string, number>()
  const goalBalances = new Map<string, number>()

  for (const row of balances.data) {
    const target = row.kind === "debt" ? debtBalances : goalBalances
    target.set(`${row.entity_id}:${row.month.slice(0, 7)}`, Number(row.balance))
  }

  return {
    today,
    firstTransactionOn,
    months,
    activeWeeks: new Set(weekly.data.map((row) => row.week_start)),
    debtBalances,
    goalBalances,
    debts,
    goals
  }
}

/** Insumos y score de los 12 meses hasta el actual */
export async function getScoreHistory(workspaceId: string, today = todayISO()) {
  const months = historyMonths(today)
  const inputs = await getScoreInputs(
    workspaceId,
    months[0],
    months[months.length - 1],
    today
  )

  return { inputs, history: scoreHistory(inputs) }
}

export interface DismissedRecommendation {
  rule: RuleKey
  entityKey: string
}

/** Recomendaciones ocultas en el mes YYYY-MM */
export async function getDismissedRecommendations(
  workspaceId: string,
  month: string
): Promise<DismissedRecommendation[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("dismissed_recommendations")
    .select("rule, entity_key")
    .eq("workspace_id", workspaceId)
    .eq("month", `${month}-01`)

  if (error) {
    throw new Error("No se pudieron cargar las recomendaciones ocultas")
  }

  return data.map((row) => ({
    rule: row.rule as RuleKey,
    entityKey: row.entity_key
  }))
}
