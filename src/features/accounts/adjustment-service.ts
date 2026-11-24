import "server-only"
import { SITE } from "@/config/site"
import {
  type ServiceResult,
  type ServiceWorkspace,
  fail
} from "@/features/workspaces/service-result"
import { todayISO } from "@/libs/dates"
import { roundCents } from "@/libs/money"
import type { AppSupabase } from "@/libs/supabase/types"
import { getAccountBalanceAt, getAccountBalances } from "./queries"
import type { AdjustAccountInput, ReconcileAccountInput } from "./schemas"
import { ACCOUNT_NOT_FOUND } from "./service"

// Ajustes de saldo de una cuenta: "Actualizar saldo", conciliar (SPEC 21) y
// borrar un ajuste. La diferencia que se guarda siempre se calcula aquí: el
// cliente solo la muestra.

/** Error cuando el ajuste no existe o no es del espacio */
export const ADJUSTMENT_NOT_FOUND = "No se encontró el ajuste"
const ADJUST_DEFAULT_ERROR = "No se pudo actualizar el saldo. Intenta de nuevo"
const ACCOUNT_ARCHIVED = "La cuenta está archivada"
const SAME_BALANCE = "El saldo ya coincide"
const ALREADY_RECONCILED = "La cuenta ya cuadra"
const RECONCILE_DEFAULT_ERROR = "No se pudo cuadrar el saldo. Intenta de nuevo"
const DELETE_ADJUSTMENT_ERROR =
  "No se pudo eliminar el ajuste. Intenta de nuevo"

// check_account_active (trigger de account_adjustments) rechaza una cuenta
// archivada con ese mensaje; otro error usa el mensaje genérico de la acción
function adjustmentInsertError(message: string, fallback: string) {
  return fail({
    error: message.includes(ACCOUNT_ARCHIVED) ? ACCOUNT_ARCHIVED : fallback
  })
}

// Cuenta del espacio con su saldo a hoy, o null si no existe
async function findAccount(workspaceId: string, accountId: string) {
  const accounts = await getAccountBalances(workspaceId)
  return accounts.find((row) => row.id === accountId) ?? null
}

/**
 * "Actualizar saldo": crea un ajuste con fecha de hoy por la diferencia
 * entre el saldo real (`data.balance`) y el saldo a hoy
 */
export async function createBalanceAdjustment(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  accountId: string,
  data: AdjustAccountInput
): Promise<ServiceResult<object>> {
  const account = await findAccount(workspace.id, accountId)

  if (!account) {
    return fail({ error: ACCOUNT_NOT_FOUND })
  }
  if (account.archived_at) {
    return fail({ error: ACCOUNT_ARCHIVED })
  }

  const amount = roundCents(data.balance - account.balance)
  if (amount === 0) {
    return fail({ fieldErrors: { balance: [SAME_BALANCE] } })
  }

  const { error } = await supabase.from("account_adjustments").insert({
    workspace_id: workspace.id,
    account_id: account.id,
    amount,
    occurred_on: todayISO(),
    occurred_time: data.occurred_time,
    note: data.note
  })

  if (error) {
    return adjustmentInsertError(error.message, ADJUST_DEFAULT_ERROR)
  }
  return { ok: true }
}

/**
 * Saldo calculado de una cuenta del espacio a la fecha `on`, para el diálogo
 * de conciliar. Solo lectura.
 */
export async function getReconcileBalance(
  workspace: ServiceWorkspace,
  accountId: string,
  on: string
): Promise<ServiceResult<{ balance: number }>> {
  const account = await findAccount(workspace.id, accountId)

  if (!account) {
    return fail({ error: ACCOUNT_NOT_FOUND })
  }

  const balance = await getAccountBalanceAt(account.id, on)
  return balance === null
    ? fail({ error: ACCOUNT_NOT_FOUND })
    : { ok: true, balance }
}

/**
 * Conciliar (SPEC 21): crea un ajuste a la fecha elegida por la diferencia
 * entre el saldo real y el saldo calculado a esa fecha. Va sin hora y al
 * final del día.
 */
export async function reconcileAccountBalance(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  accountId: string,
  data: ReconcileAccountInput
): Promise<ServiceResult<object>> {
  const account = await findAccount(workspace.id, accountId)

  if (!account) {
    return fail({ error: ACCOUNT_NOT_FOUND })
  }
  if (account.archived_at) {
    return fail({ error: ACCOUNT_ARCHIVED })
  }

  const calculated = await getAccountBalanceAt(account.id, data.occurred_on)
  if (calculated === null) {
    return fail({ error: ACCOUNT_NOT_FOUND })
  }

  const amount = roundCents(data.balance - calculated)
  if (amount === 0) {
    return fail({ fieldErrors: { balance: [ALREADY_RECONCILED] } })
  }

  // day_position 0 es "arriba": va una posición después de la mayor del día
  // en el espacio
  const { data: last, error: lastError } = await supabase
    .from("ledger_entries")
    .select("day_position")
    .eq("workspace_id", workspace.id)
    .eq("occurred_on", data.occurred_on)
    .order("day_position", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastError) {
    return fail({ error: RECONCILE_DEFAULT_ERROR })
  }

  const { error } = await supabase.from("account_adjustments").insert({
    workspace_id: workspace.id,
    account_id: account.id,
    amount,
    occurred_on: data.occurred_on,
    occurred_time: null,
    day_position: (last?.day_position ?? 0) + 1,
    note: SITE.reconciliation.note
  })

  if (error) {
    return adjustmentInsertError(error.message, RECONCILE_DEFAULT_ERROR)
  }
  return { ok: true }
}

/** Borra un ajuste de saldo del espacio */
export async function deleteAdjustmentRecord(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  id: string
): Promise<ServiceResult<object>> {
  const { data, error } = await supabase
    .from("account_adjustments")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return fail({ error: DELETE_ADJUSTMENT_ERROR })
  }
  if (data.length === 0) {
    return fail({ error: ADJUSTMENT_NOT_FOUND })
  }
  return { ok: true }
}
