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
}

// Todas las metas del espacio, en cualquier estado, con lo ahorrado
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

// Aportes y retiros de una meta, el más reciente primero
export async function getGoalContributions(
  goalId: string
): Promise<GoalContribution[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("goal_contributions")
    .select("*")
    .eq("goal_id", goalId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error("No se pudieron cargar los aportes")
  }

  return data.map((row) => ({ ...row, amount: Number(row.amount) }))
}
