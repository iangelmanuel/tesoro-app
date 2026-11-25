// Constructores de filas de ejemplo para los tests (SPEC 55b). Cada uno parte
// de valores neutros y completos (sin cast: si la fila gana una columna, `tsc`
// lo avisa) y recibe solo los campos que el test necesita.
import type { AccountWithBalance } from "@/features/accounts/types"
import type { BudgetProgress } from "@/features/budgets/queries"
import type { Debt, DebtEntry } from "@/features/debts/queries"
import type { Goal } from "@/features/goals/queries"
import type { UpcomingPayment } from "@/features/recurring-expenses/queries"
import type { UpcomingIncome } from "@/features/recurring-incomes/queries"
import type { CategoryTotal } from "@/features/reports/queries"

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const CREATED_AT = "2025-10-01T15:00:00Z"

/** Categoría de una ocurrencia de gasto o ingreso fijo */
const CATEGORY_REF = {
  id: "category",
  name: "Categoría",
  icon: "tag",
  color: "gray",
  archived_at: null
}

/** Lunes YYYY-MM-DD desde `from` (un lunes), cada `step` semanas, hasta `to` */
export function isoWeeks(from: string, to: string, step = 1) {
  const result: string[] = []
  for (
    let time = Date.parse(from);
    time <= Date.parse(to);
    time += step * WEEK_MS
  ) {
    result.push(new Date(time).toISOString().slice(0, 10))
  }
  return result
}

/** Fila de debt_overview: un préstamo activo sin saldo ni tasa */
export function debtFixture(fields: Partial<Debt>): Debt {
  return {
    id: "debt",
    workspace_id: "workspace",
    name: "Deuda",
    kind: "loan",
    status: "active",
    account_id: null,
    counterparty: null,
    opening_balance: 0,
    credit_limit: null,
    min_payment: null,
    installment: null,
    original_amount: null,
    interest_rate: null,
    rate_type: null,
    schedule: null,
    starts_on: null,
    term_months: null,
    closing_day: null,
    due_day: null,
    expected_on: null,
    fee_amount: null,
    fee_day: null,
    fee_charged_through: null,
    closed_at: null,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    balance: 0,
    paid_total: 0,
    entries_count: 0,
    last_payment_on: null,
    next_due_on: null,
    prev_due_on: null,
    paid_current_cycle: null,
    paid_previous_cycle: null,
    installments_due_current: null,
    installments_due_previous: null,
    installment_history: [],
    ...fields
  }
}

/** Movimiento de una deuda: un pago sin cuenta ni asignaciones */
export function debtEntryFixture(fields: Partial<DebtEntry>): DebtEntry {
  return {
    id: "entry",
    workspace_id: "workspace",
    debt_id: "debt",
    kind: "payment",
    amount: 0,
    occurred_on: "2026-01-01",
    occurred_time: null,
    note: null,
    account_id: null,
    transaction_id: null,
    import_id: null,
    installments: null,
    is_extra_payment: false,
    generated: false,
    day_position: 0,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    account_name: null,
    payment_account_id: null,
    description: null,
    category_id: null,
    allocations: [],
    ...fields
  }
}

/**
 * Fila de goal_progress: una meta activa sin fecha ni ahorro. Los tipos
 * generados marcan `target_date` y `completed_at` como no nulos, pero la RPC
 * los devuelve null cuando faltan.
 */
export function goalFixture(fields: Partial<Goal>): Goal {
  return {
    id: "goal",
    name: "Meta",
    icon: "target",
    color: "gray",
    status: "active",
    target_amount: 0,
    target_date: null as unknown as string,
    completed_at: null as unknown as string,
    created_at: "2025-12-01T15:00:00Z",
    saved: 0,
    contributions_count: 0,
    ...fields
  }
}

/** Cuenta bancaria activa con saldo 0 */
export function accountFixture(
  fields: Partial<AccountWithBalance>
): AccountWithBalance {
  return {
    id: "account",
    workspace_id: "workspace",
    name: "Cuenta",
    kind: "bank",
    icon: "bank",
    color: "gray",
    opening_balance: 0,
    opening_balance_on: null,
    archived_at: null,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    balance: 0,
    scheduled_balance: 0,
    last_activity_on: null,
    ...fields
  }
}

/** Ocurrencia de un gasto fijo mensual, sin pagar */
export function upcomingPaymentFixture(
  fields: Partial<UpcomingPayment>
): UpcomingPayment {
  return {
    recurringExpenseId: "recurring",
    name: "Gasto fijo",
    frequency: "monthly",
    accountId: null,
    amount: 0,
    category: CATEGORY_REF,
    dueOn: "2026-01-01",
    transactionId: null,
    paidAmount: null,
    paidOn: null,
    accountName: null,
    status: "upcoming",
    ...fields
  }
}

/** Ocurrencia de un ingreso fijo mensual, pendiente */
export function upcomingIncomeFixture(
  fields: Partial<UpcomingIncome>
): UpcomingIncome {
  return {
    recurringIncomeId: "income",
    name: "Ingreso fijo",
    amount: 0,
    category: CATEGORY_REF,
    accountId: null,
    frequency: "monthly",
    dueOn: "2026-01-01",
    receivedAmount: 0,
    remaining: 0,
    status: "pending",
    ...fields
  }
}

/** Total de gasto de una categoría */
export function categoryTotalFixture(
  categoryId: string,
  name: string,
  total: number
): CategoryTotal {
  return {
    categoryId,
    name,
    icon: "tag",
    color: "gray",
    archived: false,
    total,
    txCount: 1
  }
}

/** Progreso de una categoría; `budgetAmount` null = sin presupuesto */
export function budgetFixture(
  categoryId: string,
  name: string,
  budgetAmount: number | null,
  spent: number
): BudgetProgress {
  return {
    categoryId,
    name,
    icon: "tag",
    color: "gray",
    archived: false,
    budgetId: budgetAmount === null ? null : `budget-${categoryId}`,
    budgetAmount,
    spent,
    committed: 0
  }
}
