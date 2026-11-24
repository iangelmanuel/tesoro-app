import "server-only"
import type { IncomeAllocation } from "@/features/recurring-incomes/types"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Database } from "@/types/database"
import {
  ALREADY_PAID,
  INCOME_NOT_FOUND,
  RECURRING_NOT_FOUND
} from "./transaction-errors"

// Enlaces de un movimiento a un gasto fijo o a un ingreso fijo. Los usa
// service.ts antes de guardar y para devolver el reparto guardado.

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"]

/**
 * El gasto fijo debe ser del espacio y la ocurrencia no debe tener pago. El
 * trigger y el índice único lo garantizan en la BD; esto da un mensaje claro
 * antes de insertar. Devuelve el error o null.
 */
export async function validateRecurring(
  supabase: AppSupabase,
  workspaceId: string,
  recurringExpenseId: string,
  dueOn: string
): Promise<string | null> {
  const { data: expense } = await supabase
    .from("recurring_expenses")
    .select("id")
    .eq("id", recurringExpenseId)
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  if (!expense) {
    return RECURRING_NOT_FOUND
  }

  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("recurring_expense_id", recurringExpenseId)
    .eq("recurring_due_on", dueOn)

  return (count ?? 0) > 0 ? ALREADY_PAID : null
}

/** Enlace de un movimiento a su ingreso fijo */
export interface IncomeLink {
  recurring_income_id: string | null
}

/** Sin ingreso fijo: quita el enlace al editar */
export const NO_INCOME_LINK: IncomeLink = { recurring_income_id: null }

/**
 * Enlace de un ingreso a un ingreso fijo activo del espacio (SPEC 30). El
 * reparto entre ocurrencias (SPEC 38) lo hace la BD: el trigger de
 * transactions llama a allocate_income_receipt en la misma transacción que
 * guarda el movimiento. El cliente nunca elige las ocurrencias.
 */
export async function resolveIncomeLink(
  supabase: AppSupabase,
  workspaceId: string,
  recurringIncomeId: string
): Promise<IncomeLink | { error: string }> {
  const { data: income } = await supabase
    .from("recurring_incomes")
    .select("id")
    .eq("id", recurringIncomeId)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .maybeSingle()

  return income
    ? { recurring_income_id: income.id }
    : { error: INCOME_NOT_FOUND }
}

/** Reparto guardado de un ingreso, de la ocurrencia más antigua a la última */
export async function fetchAllocations(
  supabase: AppSupabase,
  transaction: TransactionRow
): Promise<IncomeAllocation[]> {
  if (transaction.recurring_income_id === null) {
    return []
  }
  const { data } = await supabase
    .from("recurring_income_allocations")
    .select("due_on, amount")
    .eq("transaction_id", transaction.id)
    .order("due_on")
  return data ?? []
}
