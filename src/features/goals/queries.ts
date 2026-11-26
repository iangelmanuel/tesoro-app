import "server-only"
import { createClient } from "@/libs/supabase/server"
import type { Database } from "@/types/database"

type GoalProgressRow =
  Database["public"]["Functions"]["goal_progress"]["Returns"][number]
type ContributionRow = Database["public"]["Tables"]["goal_contributions"]["Row"]

export type Goal = Omit<GoalProgressRow, "target_amount" | "saved"> & {
  target_amount: number
  saved: number
  contributions_count: number
}

export type GoalContribution = Omit<ContributionRow, "amount"> & {
  amount: number
  /** Cuenta del aporte o retiro; null = fuera de las cuentas */
  account_name: string | null
}

/** Todas las metas del espacio, en cualquier estado, con lo ahorrado */
export async function getGoals(workspaceId: string): Promise<Goal[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("goal_progress", {
    p_workspace_id: workspaceId
  })

  if (error) {
    throw new Error("No se pudieron cargar las metas")
  }

  return data.map((row) => ({
    ...row,
    target_amount: Number(row.target_amount),
    saved: Number(row.saved),
    contributions_count: Number(row.contributions_count)
  }))
}

const CONTRIBUTION_COLUMNS =
  "id, workspace_id, goal_id, amount, occurred_on, occurred_time, day_position, note, account_id, import_id, created_at, updated_at, account:accounts!goal_contributions_account_id_workspace_id_fkey (name)"

/**
 * Aportes y retiros de varias metas en una sola consulta, por meta y el más
 * reciente primero. Una meta sin aportes queda con lista vacía. Evita una
 * consulta por meta en la lista (SPEC 56a)
 */
export async function getGoalContributionsByGoal(
  goalIds: string[]
): Promise<Map<string, GoalContribution[]>> {
  const byGoal = new Map<string, GoalContribution[]>(
    goalIds.map((id) => [id, []])
  )
  if (goalIds.length === 0) {
    return byGoal
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("goal_contributions")
    .select(CONTRIBUTION_COLUMNS)
    .in("goal_id", goalIds)
    .order("occurred_on", { ascending: false })
    // Orden manual dentro del día (SPEC 19 y 45)
    .order("day_position", { ascending: true })
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error("No se pudieron cargar los aportes")
  }

  for (const { account, ...row } of data) {
    byGoal.get(row.goal_id)?.push({
      ...row,
      amount: Number(row.amount),
      account_name: account?.name ?? null
    })
  }
  return byGoal
}
