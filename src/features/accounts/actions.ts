"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { todayISO } from "@/libs/dates"
import { revalidatePersonalPages } from "@/libs/revalidate"
import { createClient } from "@/libs/supabase/server"
import { getAccountBalances } from "./queries"
import { accountSchema, adjustAccountSchema, transferSchema } from "./schemas"
import type {
  AccountActionResult,
  AccountFormState,
  AdjustAccountFormState,
  TransferFormState
} from "./types"

const ACCOUNT_NOT_FOUND = "No se encontró la cuenta"
const TRANSFER_NOT_FOUND = "No se encontró el traspaso"
const ADJUSTMENT_NOT_FOUND = "No se encontró el ajuste"
const ACCOUNT_DEFAULT_ERROR = "No se pudo guardar la cuenta. Intenta de nuevo"
const TRANSFER_DEFAULT_ERROR =
  "No se pudo guardar el traspaso. Intenta de nuevo"
const ADJUST_DEFAULT_ERROR = "No se pudo actualizar el saldo. Intenta de nuevo"
const DUPLICATE_NAME = "Ya existe una cuenta con ese nombre"
const ACCOUNT_ARCHIVED = "La cuenta está archivada"
const SAME_ACCOUNT = "Elige una cuenta distinta a la de origen"
const SAME_BALANCE = "El saldo ya coincide"

const ACCOUNT_FIELDS = [
  "name",
  "kind",
  "icon",
  "color",
  "opening_balance"
] as const

const TRANSFER_FIELDS = [
  "from_account_id",
  "to_account_id",
  "amount",
  "occurred_on",
  "note"
] as const

const ADJUST_FIELDS = ["balance", "note"] as const

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

// check_account_active lanza check_violation con su mensaje; la FK compuesta
// falla si la cuenta no es del espacio
function transferPgError(error: PostgrestError): TransferFormState {
  if (error.message.includes(ACCOUNT_ARCHIVED)) {
    return { error: ACCOUNT_ARCHIVED }
  }
  if (error.code === "23514") {
    return { fieldErrors: { to_account_id: [SAME_ACCOUNT] } }
  }
  if (error.code === "23503") {
    return { error: ACCOUNT_NOT_FOUND }
  }
  if (error.code === "42501") {
    return { error: "No tienes permiso para modificar este traspaso" }
  }
  return { error: TRANSFER_DEFAULT_ERROR }
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

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { error } = await supabase
    .from("accounts")
    .insert({ ...parsed.data, workspace_id: workspace.id })

  if (error) {
    return { ...accountPgError(error), values }
  }

  revalidatePersonalPages()
  return { ok: true }
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

  const workspace = await getPersonalWorkspace()
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

  revalidatePersonalPages()
  return { ok: true }
}

// Archiva o restaura solo si la cuenta está en el estado contrario
async function setArchived(
  id: string,
  archived: boolean
): Promise<AccountActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: ACCOUNT_NOT_FOUND }
  }

  const workspace = await getPersonalWorkspace()
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

  revalidatePersonalPages()
  return {}
}

export async function archiveAccount(id: string): Promise<AccountActionResult> {
  return setArchived(id, true)
}

export async function restoreAccount(id: string): Promise<AccountActionResult> {
  return setArchived(id, false)
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

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { error } = await supabase
    .from("transfers")
    .insert({ ...parsed.data, workspace_id: workspace.id })

  if (error) {
    return { ...transferPgError(error), values }
  }

  revalidatePersonalPages()
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

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("transfers")
    .update(parsed.data)
    .eq("id", id.data)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return { ...transferPgError(error), values }
  }
  if (data.length === 0) {
    return { error: TRANSFER_NOT_FOUND, values }
  }

  revalidatePersonalPages()
  return { ok: true }
}

export async function deleteTransfer(id: string): Promise<AccountActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: TRANSFER_NOT_FOUND }
  }

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("transfers")
    .delete()
    .eq("id", parsedId.data)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return { error: "No se pudo eliminar el traspaso. Intenta de nuevo" }
  }
  if (data.length === 0) {
    return { error: TRANSFER_NOT_FOUND }
  }

  revalidatePersonalPages()
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

  const workspace = await getPersonalWorkspace()
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

  revalidatePersonalPages()
  return { ok: true }
}

export async function deleteAdjustment(
  id: string
): Promise<AccountActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: ADJUSTMENT_NOT_FOUND }
  }

  const workspace = await getPersonalWorkspace()
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

  revalidatePersonalPages()
  return {}
}
