import type { Route } from "next"

export type FactorKey =
  | "savings_rate"
  | "debt_to_income"
  | "emergency_cushion"
  | "budgets"
  | "card_utilization"
  | "goals"
  | "regularity"

export type Band = "weak" | "fair" | "good" | "excellent"

// FactorResult, ScoreResult y Recommendation reciben la clave del espacio
// (Personal por defecto; Empresa usa las de business-score)

export type FactorResult<K extends string = FactorKey> =
  | { key: K; weight: number; value: number; points: number } // points 0–100
  | { key: K; weight: number; excluded: string } // motivo

export type ScoreResult<K extends string = FactorKey> =
  | { month: string; score: number; band: Band; factors: FactorResult<K>[] }
  | { month: string; insufficient: string[] } // motivos

export type RuleKey =
  | "deficit"
  | "category_growth"
  | "budget_exceeded"
  | "goal_at_risk"
  | "high_utilization"
  | "highest_rate_first"
  | "overdue_payment"
  | "low_cushion"
  | "unbudgeted_spending"
  | "irregular_records"

export type Severity = "high" | "medium" | "low"

export type Recommendation<R extends string = RuleKey> = {
  rule: R
  entityKey: string
  severity: Severity
  title: string
  evidence: string // el dato en que se basa
  amount: number // para desempatar; 0 si no aplica
  href: Route
  linkLabel: string
}

/** Fila de score_monthly_inputs, con el mes como YYYY-MM */
export interface MonthlyInput {
  month: string
  income: number
  expense: number
  closingBalance: number
  budgetedCount: number
  withinBudgetCount: number
}

/** Campos de una fila de debt_overview que usa el score */
export interface ScoreDebt {
  id: string
  kind: "credit_card" | "loan" | "receivable"
  status: "active" | "paid" | "archived"
  credit_limit: number | null
  min_payment: number | null
  installment: number | null
  closed_at: string | null
  created_at: string
}

/** Campos de una fila de goal_progress que usa el score */
export interface ScoreGoal {
  id: string
  target_amount: number
  target_date: string | null
  status: "active" | "completed" | "archived"
  completed_at: string | null
  created_at: string
}

/**
 * Insumos ya consultados. `months` cubre al menos los 3 meses anteriores al
 * primer mes que se calcula; `balances` está indexado por `${id}:${YYYY-MM}`.
 */
export interface ScoreInputs {
  today: string
  firstTransactionOn: string | null
  months: MonthlyInput[]
  activeWeeks: Set<string>
  debtBalances: Map<string, number>
  goalBalances: Map<string, number>
  debts: ScoreDebt[]
  goals: ScoreGoal[]
}
