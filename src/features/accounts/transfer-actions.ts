"use server"

import { z } from "zod"
import { requireWritableWorkspace } from "@/features/workspaces/queries"
import { revalidateWorkspacePages } from "@/features/workspaces/revalidate"
import { readFormValues } from "@/libs/form-data"
import { createClient } from "@/libs/supabase/server"
import { transferSchema } from "./schemas"
import {
  TRANSFER_NOT_FOUND,
  createTransferRecord,
  deleteTransferRecord,
  updateTransferRecord
} from "./transfer-service"
import type { AccountActionResult, TransferFormState } from "./types"

const TRANSFER_FIELDS = [
  "from_account_id",
  "to_account_id",
  "amount",
  "occurred_on",
  "occurred_time",
  "note"
] as const

const idSchema = z.uuid()

export async function createTransfer(
  _prevState: TransferFormState,
  formData: FormData
): Promise<TransferFormState> {
  const values = readFormValues(formData, TRANSFER_FIELDS)
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
  const values = readFormValues(formData, TRANSFER_FIELDS)
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
