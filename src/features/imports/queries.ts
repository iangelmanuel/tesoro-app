import { type Debt, getDebts } from "@/features/debts/queries"
import { getGoals } from "@/features/goals/queries"
import { createClient } from "@/libs/supabase/server"
import type { Database } from "@/types/database"
import { importStatsSchema } from "./schemas"
import type { ImportStats } from "./types"

type ImportRow = Database["public"]["Tables"]["imports"]["Row"]

export type ImportRecord = Omit<ImportRow, "stats"> & {
  stats: ImportStats
  /** Movimientos que siguen enlazados; los borra "Deshacer" */
  transactions_count: number
}

const EMPTY_STATS: ImportStats = {
  read: 0,
  imported: 0,
  skipped: 0,
  duplicates: 0,
  errors: 0
}

// Historial de importaciones del espacio, la más reciente primero
export async function getImports(workspaceId: string): Promise<ImportRecord[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("imports")
    .select("*, transactions (count)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error("No se pudieron cargar las importaciones")
  }

  return data.map(({ transactions, stats, ...row }) => {
    const parsed = importStatsSchema.safeParse(stats)
    return {
      ...row,
      stats: parsed.success ? parsed.data : EMPTY_STATS,
      transactions_count: transactions[0]?.count ?? 0
    }
  })
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
