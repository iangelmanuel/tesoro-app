import type { TransactionType } from "@/features/transactions/filters"
import type { TransactionWithCategory } from "@/features/transactions/queries"
import { createClient } from "@/libs/supabase/server"

// Todas las agregaciones corren en Postgres (RPC security invoker, con RLS).
// `numeric` puede llegar como string: se convierte con Number() aquí.

export interface MonthlyTotal {
  /** Primer día del mes (YYYY-MM-DD) */
  month: string
  income: number
  expense: number
  balance: number
  txCount: number
}

export interface CategoryTotal {
  categoryId: string
  name: string
  icon: string
  color: string
  archived: boolean
  total: number
  txCount: number
}

/** Totales por mes entre `from` y `to`, con los meses vacíos en cero */
export async function getMonthlyTotals(
  workspaceId: string,
  from: string,
  to: string
): Promise<MonthlyTotal[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("monthly_totals", {
    p_workspace_id: workspaceId,
    p_from: from,
    p_to: to
  })

  if (error) {
    throw new Error("No se pudieron calcular los totales por mes")
  }

  return data.map((row) => {
    const income = Number(row.income)
    const expense = Number(row.expense)
    return {
      month: row.month,
      income,
      expense,
      balance: income - expense,
      txCount: Number(row.tx_count)
    }
  })
}

/** Totales por categoría de un tipo, ordenados por total descendente */
export async function getCategoryTotals(
  workspaceId: string,
  from: string,
  to: string,
  type: TransactionType
): Promise<CategoryTotal[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("category_totals", {
    p_workspace_id: workspaceId,
    p_from: from,
    p_to: to,
    p_type: type
  })

  if (error) {
    throw new Error("No se pudieron calcular los totales por categoría")
  }

  return data.map((row) => ({
    categoryId: row.category_id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    archived: row.archived,
    total: Number(row.total),
    txCount: Number(row.tx_count)
  }))
}

/** Balance acumulado histórico del espacio */
export async function getWorkspaceBalance(workspaceId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("workspace_balance", {
    p_workspace_id: workspaceId
  })

  if (error) {
    throw new Error("No se pudo calcular el balance acumulado")
  }

  return Number(data)
}

/** Últimos movimientos del espacio, del más reciente al más antiguo */
export async function getRecentTransactions(
  workspaceId: string,
  limit: number
): Promise<TransactionWithCategory[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("transactions")
    .select("*, category:categories!inner (id, name, icon, color, archived_at)")
    .eq("workspace_id", workspaceId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error("No se pudieron cargar los últimos movimientos")
  }

  return data
}
