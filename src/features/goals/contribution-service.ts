import "server-only"
import type { PostgrestError } from "@supabase/supabase-js"
import {
  type ServiceFailure,
  type ServiceResult,
  type ServiceWorkspace,
  fail
} from "@/features/workspaces/service-result"
import { moveErrorMessage } from "@/libs/move-error"
import type { AppSupabase } from "@/libs/supabase/types"
import type { ContributionInput } from "./schemas"
import { GOAL_NOT_FOUND, type LoadedGoal } from "./service"

// Aportes y retiros de una meta con un cliente dado (SPEC 43): las actions
// lo usan con la sesión de cookies y el MCP con el Bearer del agente. Aquí no
// se lee la sesión: registrar recibe la meta ya resuelta en el espacio y
// editar, borrar o reordenar reciben el espacio y cargan el aporte.

const GOAL_NOT_ACTIVE = "Reactiva la meta para registrar aportes"
const OVER_WITHDRAWAL = "No puedes retirar más de lo ahorrado"
export const CONTRIBUTION_NOT_FOUND = "No se encontró el aporte"
const CONTRIBUTION_DEFAULT_ERROR =
  "No se pudo guardar el aporte. Intenta de nuevo"
const FUTURE_DATE = "La fecha no puede ser futura"
const ARCHIVED_ACCOUNT = "La cuenta está archivada"
const SAME_TRANSFER_ACCOUNT = "Elige una cuenta distinta a la que paga"

/** Suma de aportes y retiros de la meta */
async function goalSaved(supabase: AppSupabase, goalId: string) {
  const { data, error } = await supabase
    .from("goal_contributions")
    .select("amount")
    .eq("goal_id", goalId)

  if (error) {
    throw new Error("No se pudieron cargar los aportes")
  }
  return data.reduce((sum, row) => sum + Number(row.amount), 0)
}

/**
 * Errores de Postgres de un aporte, como errores de formulario. Los triggers
 * de goal_contributions lanzan check_violation con su mensaje.
 */
function contributionPgError(
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

/** Aporte del espacio con el estado de su meta, o null si no existe o es ajeno */
async function loadContribution(
  supabase: AppSupabase,
  workspaceId: string,
  id: string
) {
  const { data } = await supabase
    .from("goal_contributions")
    .select("id, goal_id, amount, goal:savings_goals!inner (status)")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  return data
}

/**
 * Aporte editable: existe en el espacio, su meta está activa y quitarlo (o
 * cambiarlo por `newAmount`) no deja lo ahorrado en negativo
 */
async function editableContribution(
  supabase: AppSupabase,
  workspaceId: string,
  id: string,
  newAmount: number
): Promise<ServiceFailure | null> {
  const contribution = await loadContribution(supabase, workspaceId, id)
  if (!contribution) {
    return fail({ error: CONTRIBUTION_NOT_FOUND })
  }
  if (contribution.goal.status !== "active") {
    return fail({ error: GOAL_NOT_ACTIVE })
  }

  const saved = await goalSaved(supabase, contribution.goal_id)
  if (saved - Number(contribution.amount) + newAmount < 0) {
    return fail({ fieldErrors: { amount: [OVER_WITHDRAWAL] } })
  }
  return null
}

/**
 * Edita un aporte o retiro: monto, fecha, hora y nota. La cuenta no se toca
 * (SPEC 16).
 */
export async function updateGoalContributionRecord(
  supabase: AppSupabase,
  workspace: Pick<ServiceWorkspace, "id">,
  id: string,
  data: ContributionInput
): Promise<ServiceResult<object>> {
  const failure = await editableContribution(
    supabase,
    workspace.id,
    id,
    data.amount
  )
  if (failure) return failure

  const { amount, occurred_on, occurred_time, note } = data
  const { data: updated, error } = await supabase
    .from("goal_contributions")
    .update({ amount, occurred_on, occurred_time, note })
    .eq("id", id)
    .select("id")

  if (error) {
    return fail(contributionPgError(error))
  }
  if (updated.length === 0) {
    return fail({ error: CONTRIBUTION_NOT_FOUND })
  }
  return { ok: true }
}

// En un borrado, el único error por campo posible es el del saldo
function deleteError(failure: Pick<ServiceFailure, "error" | "fieldErrors">) {
  return fail({ error: failure.error ?? failure.fieldErrors?.amount?.[0] })
}

/**
 * Borra un aporte o retiro. Todos los errores llegan como `error`: el borrado
 * no tiene formulario.
 */
export async function deleteGoalContributionRecord(
  supabase: AppSupabase,
  workspace: Pick<ServiceWorkspace, "id">,
  id: string
): Promise<ServiceResult<object>> {
  const failure = await editableContribution(supabase, workspace.id, id, 0)
  if (failure) return deleteError(failure)

  const { data, error } = await supabase
    .from("goal_contributions")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    return deleteError(contributionPgError(error))
  }
  if (data.length === 0) {
    return fail({ error: CONTRIBUTION_NOT_FOUND })
  }
  return { ok: true }
}

/** Reordena un aporte o retiro dentro del mismo día de su meta (SPEC 45) */
export async function moveGoalContributionRecord(
  supabase: AppSupabase,
  id: string,
  targetId: string
): Promise<ServiceResult<object>> {
  const { error } = await supabase.rpc("move_goal_contribution", {
    p_id: id,
    p_target_id: targetId
  })

  if (error) {
    return fail({ error: moveErrorMessage(error) })
  }
  return { ok: true }
}
