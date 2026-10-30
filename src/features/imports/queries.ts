import { type Debt, getDebts } from "@/features/debts/queries"
import { getGoals } from "@/features/goals/queries"
import { createClient } from "@/libs/supabase/server"
import type { Database } from "@/types/database"
import { importStatsSchema } from "./schemas"
import type { ImportStats } from "./types"

type ImportRow = Database["public"]["Tables"]["imports"]["Row"]

export type ImportRecord = Omit<ImportRow, "stats"> & {
  stats: ImportStats
  /** Filas del destino que siguen enlazadas; las borra "Deshacer" */
  rows_count: number
  /** Deudas: movimientos creados con los pagos; "Deshacer" también los borra */
  linked_transactions: number
}

const EMPTY_STATS: ImportStats = {
  read: 0,
  imported: 0,
  skipped: 0,
  duplicates: 0,
  errors: 0
}

// Historial de importaciones del espacio, la más reciente primero, con las
// filas que siguen enlazadas en la tabla de su destino
export async function getImports(workspaceId: string): Promise<ImportRecord[]> {
  const supabase = await createClient()
  const [imports, linked] = await Promise.all([
    supabase
      .from("imports")
      .select(
        "*, transactions (count), recurring_expenses (count), debt_entries (count), goal_contributions (count)"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    // Pagos importados que crearon su movimiento
    supabase
      .from("debt_entries")
      .select("import_id")
      .eq("workspace_id", workspaceId)
      .not("import_id", "is", null)
      .not("transaction_id", "is", null)
  ])

  if (imports.error || linked.error) {
    throw new Error("No se pudieron cargar las importaciones")
  }

  const linkedCounts = new Map<string, number>()
  for (const { import_id: importId } of linked.data) {
    if (importId)
      linkedCounts.set(importId, (linkedCounts.get(importId) ?? 0) + 1)
  }

  return imports.data.map(
    ({
      transactions,
      recurring_expenses: recurring,
      debt_entries: debtEntries,
      goal_contributions: contributions,
      stats,
      ...row
    }) => {
      const parsed = importStatsSchema.safeParse(stats)
      const counts = {
        transactions,
        recurring_expenses: recurring,
        debt_entries: debtEntries,
        goal_contributions: contributions
      }
      return {
        ...row,
        stats: parsed.success ? parsed.data : EMPTY_STATS,
        rows_count: counts[row.target][0]?.count ?? 0,
        linked_transactions: linkedCounts.get(row.id) ?? 0
      }
    }
  )
}

export interface DebtLinkOption {
  id: string
  name: string
  kind: Debt["kind"]
  balance: number
}

export interface GoalLinkOption {
  id: string
  name: string
  saved: number
}

// Deudas activas con su saldo: destinos de una importación de deudas
export async function getActiveDebtOptions(
  workspaceId: string
): Promise<DebtLinkOption[]> {
  const debts = await getDebts(workspaceId)
  return debts
    .filter((debt) => debt.status === "active")
    .map(({ id, name, kind, balance }) => ({ id, name, kind, balance }))
}

// Metas activas con lo ahorrado: destinos de una importación de metas
export async function getActiveGoalOptions(
  workspaceId: string
): Promise<GoalLinkOption[]> {
  const goals = await getGoals(workspaceId)
  return goals
    .filter((goal) => goal.status === "active")
    .map(({ id, name, saved }) => ({ id, name, saved }))
}
