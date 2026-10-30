import { createClient } from "@/libs/supabase/server"
import { monthStart } from "./month"

export interface BudgetProgress {
  categoryId: string
  name: string
  icon: string
  color: string
  archived: boolean
  /** null en las categorías con gastos y sin presupuesto */
  budgetId: string | null
  budgetAmount: number | null
  /** Gastos de la categoría en el mes, futuros incluidos */
  spent: number
  /** Ocurrencias pendientes de gastos fijos con vencimiento en el mes */
  committed: number
}

// Presupuestos del mes YYYY-MM y categorías de gasto con movimientos y sin
// presupuesto. Primero las presupuestadas, cada grupo por nombre.
export async function getBudgetProgress(
  workspaceId: string,
  month: string
): Promise<BudgetProgress[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("budget_progress", {
    p_workspace_id: workspaceId,
    p_month: monthStart(month)
  })

  if (error) {
    throw new Error("No se pudieron cargar los presupuestos")
  }

  // numeric puede llegar como number o string
  return data.map((row) => ({
    categoryId: row.category_id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    archived: row.archived,
    budgetId: row.budget_id,
    budgetAmount: row.budget_amount === null ? null : Number(row.budget_amount),
    spent: Number(row.spent),
    committed: Number(row.committed)
  }))
}

// Para el estado vacío: "Copiar del mes anterior" solo si ese mes tiene
export async function hasBudgets(workspaceId: string, month: string) {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("budgets")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("month", monthStart(month))
    .limit(1)

  if (error) {
    throw new Error("No se pudieron cargar los presupuestos")
  }
  return (count ?? 0) > 0
}
