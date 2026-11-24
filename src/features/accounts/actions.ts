"use server"

import { z } from "zod"
import { requireWritableWorkspace } from "@/features/workspaces/queries"
import { revalidateWorkspacePages } from "@/features/workspaces/revalidate"
import { readFormValues } from "@/libs/form-data"
import { createClient } from "@/libs/supabase/server"
import { accountSchema } from "./schemas"
import {
  ACCOUNT_NOT_FOUND,
  createAccountRecord,
  setAccountArchived,
  updateAccountRecord
} from "./service"
import type { AccountActionResult, AccountFormState } from "./types"

// Crear, editar, archivar y restaurar cuentas. Traspasos en
// transfer-actions.ts; ajustes de saldo en adjustment-actions.ts.

const ACCOUNT_FIELDS = [
  "name",
  "kind",
  "icon",
  "color",
  "opening_balance",
  "opening_balance_on"
] as const

const idSchema = z.uuid()

export async function createAccount(
  _prevState: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const values = readFormValues(formData, ACCOUNT_FIELDS)
  const parsed = accountSchema.safeParse(values)

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await requireWritableWorkspace(formData.get("workspace_id"))
  const supabase = await createClient()
  const result = await createAccountRecord(supabase, workspace, parsed.data)

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
  }

  revalidateWorkspacePages(workspace)
  return { ok: true, account: result.after }
}

export async function updateAccount(
  _prevState: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const values = readFormValues(formData, ACCOUNT_FIELDS)
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
  const result = await updateAccountRecord(
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
  const result = await setAccountArchived(
    supabase,
    workspace,
    parsedId.data,
    archived
  )

  if (!result.ok) {
    return { error: result.error }
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
