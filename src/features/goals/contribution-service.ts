import type { PostgrestError } from "@supabase/supabase-js"
import {
  type ServiceFailure,
  type ServiceResult,
  fail
} from "@/libs/service-result"
import type { AppSupabase } from "@/libs/supabase/types"
import type { ContributionInput } from "./schemas"

// Aportes y retiros de una meta con un cliente dado (SPEC 43): las actions
// lo usan con la sesión de cookies y el MCP con el Bearer del agente. La
// meta llega resuelta en el espacio: aquí no se lee la sesión.

export const GOAL_NOT_FOUND = "No se encontró la meta"
export const GOAL_NOT_ACTIVE = "Reactiva la meta para registrar aportes"
export const OVER_WITHDRAWAL = "No puedes retirar más de lo ahorrado"
const CONTRIBUTION_DEFAULT_ERROR =
  "No se pudo guardar el aporte. Intenta de nuevo"
const FUTURE_DATE = "La fecha no puede ser futura"
const ARCHIVED_ACCOUNT = "La cuenta está archivada"
const SAME_TRANSFER_ACCOUNT = "Elige una cuenta distinta a la que paga"

/** Meta del espacio, o null si no existe o es ajena */
export async function loadGoal(
  supabase: AppSupabase,
  workspaceId: string,
  goalId: string
) {
  const { data } = await supabase
    .from("savings_goals")
    .select("id, workspace_id, name, status, target_date")
    .eq("id", goalId)
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  return data
}

export type LoadedGoal = NonNullable<Awaited<ReturnType<typeof loadGoal>>>

/** Suma de aportes y retiros de la meta */
export async function goalSaved(supabase: AppSupabase, goalId: string) {
  const { data, error } = await supabase
    .from("goal_contributions")
    .select("amount")
    .eq("goal_id", goalId)

  if (error) {
    throw new Error("No se pudieron cargar los aportes")
  }
  return data.reduce((sum, row) => sum + Number(row.amount), 0)
}

// Los triggers de goal_contributions lanzan check_violation con su mensaje
export function contributionPgError(
  error: PostgrestError
): Omit<ServiceFailure, "ok"> {
  if (error.message.includes(OVER_WITHDRAWAL)) {
    return { fieldErrors: { amount: [OVER_WITHDRAWAL] } }
  }
  if (error.message.includes(GOAL_NOT_ACTIVE)) {
    return { error: GOAL_NOT_ACTIVE }
  }
  if (error.message.includes("fecha del aporte")) {
    return { fieldErrors: { occurred_on: [FUTURE_DATE] } }
  }
  if (error.message.includes(ARCHIVED_ACCOUNT)) {
    return { fieldErrors: { account_id: [ARCHIVED_ACCOUNT] } }
  }
  // El traspaso desde la misma cuenta que paga lo frena transfers_check
  if (error.message.includes("transfers_check")) {
    return { fieldErrors: { transfer_from: [SAME_TRANSFER_ACCOUNT] } }
  }
  if (error.code === "23503" && error.message.includes("account_id")) {
    return { fieldErrors: { account_id: ["Elige una cuenta válida"] } }
  }
  if (error.code === "23503") {
    return { error: GOAL_NOT_FOUND }
  }
  if (error.code === "42501") {
    return { error: "No tienes permiso para modificar este aporte" }
  }
  return { error: CONTRIBUTION_DEFAULT_ERROR }
}

/**
 * Aporte (monto positivo) o retiro (negativo) con record_goal_contribution,
 * con el traspaso previo en la misma transacción. La meta debe estar activa
 * y un retiro no puede pasar de lo ahorrado.
 */
export async function recordGoalContributionRecord(
  supabase: AppSupabase,
  goal: Pick<LoadedGoal, "id" | "status">,
  data: ContributionInput
): Promise<ServiceResult<{ contributionId: string }>> {
  if (goal.status !== "active") {
    return fail({ error: GOAL_NOT_ACTIVE })
  }
  if ((await goalSaved(supabase, goal.id)) + data.amount < 0) {
    return fail({ fieldErrors: { amount: [OVER_WITHDRAWAL] } })
  }

  const { amount, occurred_on, occurred_time, note, account_id } = data
  const hasTransfer = account_id !== null && data.transfer_from !== null

  const { data: id, error } = await supabase.rpc("record_goal_contribution", {
    p_goal_id: goal.id,
    p_amount: amount,
    p_occurred_on: occurred_on,
    p_occurred_time: occurred_time ?? undefined,
    // Los tipos generados no marcan el parámetro como nullable
    p_note: note as string,
    p_account_id: account_id ?? undefined,
    p_transfer_from: hasTransfer
      ? (data.transfer_from ?? undefined)
      : undefined,
    p_transfer_amount: hasTransfer
      ? (data.transfer_amount ?? undefined)
      : undefined
  })

  if (error) {
    return fail(contributionPgError(error))
  }
  return { ok: true, contributionId: id }
}
