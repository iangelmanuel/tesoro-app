"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"
import { SITE } from "@/config/site"
import { requireWritableWorkspace } from "@/features/workspaces/queries"
import { todayISO } from "@/libs/dates"
import { revalidateWorkspacePages } from "@/libs/revalidate"
import { createClient } from "@/libs/supabase/server"
import { getAccountBalanceAt, getAccountBalances } from "./queries"
import {
  accountSchema,
  adjustAccountSchema,
  reconcileAccountSchema,
  transferSchema
} from "./schemas"
import {
  TRANSFER_NOT_FOUND,
  createTransferRecord,
  deleteTransferRecord,
  updateTransferRecord
} from "./transfer-service"
import type {
  AccountActionResult,
  AccountFormState,
  AdjustAccountFormState,
  ReconcileFormState,
  TransferFormState
} from "./types"

const ACCOUNT_NOT_FOUND = "No se encontró la cuenta"
const ADJUSTMENT_NOT_FOUND = "No se encontró el ajuste"
const ACCOUNT_DEFAULT_ERROR = "No se pudo guardar la cuenta. Intenta de nuevo"
const ADJUST_DEFAULT_ERROR = "No se pudo actualizar el saldo. Intenta de nuevo"
const DUPLICATE_NAME = "Ya existe una cuenta con ese nombre"
const ACCOUNT_ARCHIVED = "La cuenta está archivada"
const SAME_BALANCE = "El saldo ya coincide"
const ALREADY_RECONCILED = "La cuenta ya cuadra"
const RECONCILE_DEFAULT_ERROR =
  "No se pudo conciliar la cuenta. Intenta de nuevo"

const ACCOUNT_FIELDS = [
  "name",
  "kind",
  "icon",
  "color",
  "opening_balance",
  "opening_balance_on"
] as const

const TRANSFER_FIELDS = [
  "from_account_id",
  "to_account_id",
  "amount",
  "occurred_on",
  "occurred_time",
  "note"
] as const

const ADJUST_FIELDS = ["balance", "occurred_time", "note"] as const

const RECONCILE_FIELDS = ["balance", "occurred_on"] as const

const idSchema = z.uuid()

// Los montos se restan en JS: se redondean a centavos para no arrastrar error
// de punto flotante
const roundCents = (value: number) => Math.round(value * 100) / 100

function accountPgError(error: PostgrestError): AccountFormState {
  // Índice único accounts_unique_name
  if (error.code === "23505") {
    return { fieldErrors: { name: [DUPLICATE_NAME] } }
  }
  if (error.code === "42501") {
    return { error: "No tienes permiso para modificar esta cuenta" }
  }
  return { error: ACCOUNT_DEFAULT_ERROR }
}

function readValues<const T extends readonly string[]>(
  formData: FormData,
  fields: T
) {
  return Object.fromEntries(
    fields.map((key) => {
      const value = formData.get(key)
      return [key, typeof value === "string" ? value : ""]
    })
  ) as Record<T[number], string>
}

export async function createAccount(
  _prevState: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const values = readValues(formData, ACCOUNT_FIELDS)
  const parsed = accountSchema.safeParse(values)

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await requireWritableWorkspace(formData.get("workspace_id"))
  const supabase = await createClient()
  const { data: account, error } = await supabase
    .from("accounts")
    .insert({ ...parsed.data, workspace_id: workspace.id })
    .select("*")
    .single()

  if (error) {
    return { ...accountPgError(error), values }
  }

  revalidateWorkspacePages(workspace)
  return { ok: true, account }
}

export async function updateAccount(
  _prevState: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const values = readValues(formData, ACCOUNT_FIELDS)
  const id = idSchema.safeParse(formData.get("id"))

  if (!id.success) {
    return { error: ACCOUNT_NOT_FOUND, values }
  }

  const parsed = accountSchema.safeParse(values)
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await requireWritableWorkspace(formData.get("workspace_id"))
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("accounts")
    .update(parsed.data)
    .eq("id", id.data)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return { ...accountPgError(error), values }
  }
  if (data.length === 0) {
    return { error: ACCOUNT_NOT_FOUND, values }
  }

  revalidateWorkspacePages(workspace)
  return { ok: true }
}

// Archiva o restaura solo si la cuenta está en el estado contrario
async function setArchived(
  workspaceId: string,
  id: string,
  archived: boolean
): Promise<AccountActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: ACCOUNT_NOT_FOUND }
  }

  const workspace = await requireWritableWorkspace(workspaceId)
  const supabase = await createClient()
  const query = supabase
    .from("accounts")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", parsedId.data)
    .eq("workspace_id", workspace.id)

  const { data, error } = await (
    archived
      ? query.is("archived_at", null)
      : query.not("archived_at", "is", null)
  ).select("id")

  if (error) {
    return { error: "No se pudo actualizar la cuenta. Intenta de nuevo" }
  }
  if (data.length === 0) {
    return { error: ACCOUNT_NOT_FOUND }
  }

  revalidateWorkspacePages(workspace)
  return {}
}

export async function archiveAccount(
  workspaceId: string,
  id: string
): Promise<AccountActionResult> {
  return setArchived(workspaceId, id, true)
}

export async function restoreAccount(
  workspaceId: string,
  id: string
): Promise<AccountActionResult> {
  return setArchived(workspaceId, id, false)
}

export async function createTransfer(
  _prevState: TransferFormState,
  formData: FormData
): Promise<TransferFormState> {
  const values = readValues(formData, TRANSFER_FIELDS)
  const parsed = transferSchema.safeParse(values)

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await requireWritableWorkspace(formData.get("workspace_id"))
  const supabase = await createClient()
  const result = await createTransferRecord(supabase, workspace, parsed.data)

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
  }

  revalidateWorkspacePages(workspace)
  return { ok: true }
}

export async function updateTransfer(
  _prevState: TransferFormState,
  formData: FormData
): Promise<TransferFormState> {
  const values = readValues(formData, TRANSFER_FIELDS)
  const id = idSchema.safeParse(formData.get("id"))

  if (!id.success) {
    return { error: TRANSFER_NOT_FOUND, values }
  }

  const parsed = transferSchema.safeParse(values)
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await requireWritableWorkspace(formData.get("workspace_id"))
  const supabase = await createClient()
  const result = await updateTransferRecord(
    supabase,
    workspace,
    id.data,
    parsed.data
  )

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
  }

  revalidateWorkspacePages(workspace)
  return { ok: true }
}

export async function deleteTransfer(
  workspaceId: string,
  id: string
): Promise<AccountActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: TRANSFER_NOT_FOUND }
  }

  const workspace = await requireWritableWorkspace(workspaceId)
  const supabase = await createClient()
  const result = await deleteTransferRecord(supabase, workspace, parsedId.data)

  if (!result.ok) {
    return { error: result.error }
  }

  revalidateWorkspacePages(workspace)
  return {}
}

// "Actualizar saldo": crea un ajuste con fecha de hoy por la diferencia entre
// el saldo real y el saldo a hoy
export async function adjustAccountBalance(
  _prevState: AdjustAccountFormState,
  formData: FormData
): Promise<AdjustAccountFormState> {
  const values = readValues(formData, ADJUST_FIELDS)
  const accountId = idSchema.safeParse(formData.get("account_id"))

  if (!accountId.success) {
    return { error: ACCOUNT_NOT_FOUND, values }
  }

  const parsed = adjustAccountSchema.safeParse(values)
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await requireWritableWorkspace(formData.get("workspace_id"))
  const account = (await getAccountBalances(workspace.id)).find(
    (row) => row.id === accountId.data
  )

  if (!account) {
    return { error: ACCOUNT_NOT_FOUND, values }
  }
  if (account.archived_at) {
    return { error: ACCOUNT_ARCHIVED, values }
  }

  const amount = roundCents(parsed.data.balance - account.balance)
  if (amount === 0) {
    return { fieldErrors: { balance: [SAME_BALANCE] }, values }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("account_adjustments").insert({
    workspace_id: workspace.id,
    account_id: account.id,
    amount,
    occurred_on: todayISO(),
    occurred_time: parsed.data.occurred_time,
    note: parsed.data.note
  })

  if (error) {
    return {
      error: error.message.includes(ACCOUNT_ARCHIVED)
        ? ACCOUNT_ARCHIVED
        : ADJUST_DEFAULT_ERROR,
      values
    }
  }

  revalidateWorkspacePages(workspace)
  return { ok: true }
}

// Saldo calculado a una fecha para el diálogo de conciliar. Solo lectura: la
// diferencia que se guarda la recalcula reconcileAccountAction.
export async function getReconcileBalanceAction(
  workspaceId: string,
  accountId: string,
  on: string
): Promise<{ balance?: number; error?: string }> {
  const parsedId = idSchema.safeParse(accountId)
  const parsedOn = z.iso
    .date()
    .refine((value) => value <= todayISO())
    .safeParse(on)

  if (!parsedId.success || !parsedOn.success) {
    return { error: ACCOUNT_NOT_FOUND }
  }

  const workspace = await requireWritableWorkspace(workspaceId)
  const account = (await getAccountBalances(workspace.id)).find(
    (row) => row.id === parsedId.data
  )

  if (!account) {
    return { error: ACCOUNT_NOT_FOUND }
  }

  const balance = await getAccountBalanceAt(account.id, parsedOn.data)
  return balance === null ? { error: ACCOUNT_NOT_FOUND } : { balance }
}

// Conciliar (SPEC 21): crea un ajuste a la fecha elegida por la diferencia
// entre el saldo real y el saldo calculado a esa fecha. La diferencia se
// calcula aquí: el cliente solo la muestra.
export async function reconcileAccountAction(
  _prevState: ReconcileFormState,
  formData: FormData
): Promise<ReconcileFormState> {
  const values = readValues(formData, RECONCILE_FIELDS)
  const accountId = idSchema.safeParse(formData.get("account_id"))

  if (!accountId.success) {
    return { error: ACCOUNT_NOT_FOUND, values }
  }

  const parsed = reconcileAccountSchema.safeParse(values)
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await requireWritableWorkspace(formData.get("workspace_id"))
  const account = (await getAccountBalances(workspace.id)).find(
    (row) => row.id === accountId.data
  )

  if (!account) {
    return { error: ACCOUNT_NOT_FOUND, values }
  }
  if (account.archived_at) {
    return { error: ACCOUNT_ARCHIVED, values }
  }

  const calculated = await getAccountBalanceAt(
    account.id,
    parsed.data.occurred_on
  )
  if (calculated === null) {
    return { error: ACCOUNT_NOT_FOUND, values }
  }

  const amount = roundCents(parsed.data.balance - calculated)
  if (amount === 0) {
    return { fieldErrors: { balance: [ALREADY_RECONCILED] }, values }
  }

  const supabase = await createClient()

  // Sin hora y al final del día: day_position 0 es "arriba", así que va una
  // posición después de la mayor del día en el espacio
  const { data: last, error: lastError } = await supabase
    .from("ledger_entries")
    .select("day_position")
    .eq("workspace_id", workspace.id)
    .eq("occurred_on", parsed.data.occurred_on)
    .order("day_position", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastError) {
    return { error: RECONCILE_DEFAULT_ERROR, values }
  }

  const { error } = await supabase.from("account_adjustments").insert({
    workspace_id: workspace.id,
    account_id: account.id,
    amount,
    occurred_on: parsed.data.occurred_on,
    occurred_time: null,
    day_position: (last?.day_position ?? 0) + 1,
    note: SITE.reconciliation.note
  })

  if (error) {
    return {
      error: error.message.includes(ACCOUNT_ARCHIVED)
        ? ACCOUNT_ARCHIVED
        : RECONCILE_DEFAULT_ERROR,
      values
    }
  }

  revalidateWorkspacePages(workspace)
  return { ok: true }
}

export async function deleteAdjustment(
  workspaceId: string,
  id: string
): Promise<AccountActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: ADJUSTMENT_NOT_FOUND }
  }

  const workspace = await requireWritableWorkspace(workspaceId)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("account_adjustments")
    .delete()
    .eq("id", parsedId.data)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return { error: "No se pudo eliminar el ajuste. Intenta de nuevo" }
  }
  if (data.length === 0) {
    return { error: ADJUSTMENT_NOT_FOUND }
  }

  revalidateWorkspacePages(workspace)
  return {}
}
