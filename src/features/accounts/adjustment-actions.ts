"use server"

import { z } from "zod"
import { requireWritableWorkspace } from "@/features/workspaces/queries"
import { revalidateWorkspacePages } from "@/features/workspaces/revalidate"
import { todayISO } from "@/libs/dates"
import { readFormValues } from "@/libs/form-data"
import { createClient } from "@/libs/supabase/server"
import {
  ADJUSTMENT_NOT_FOUND,
  createBalanceAdjustment,
  deleteAdjustmentRecord,
  getReconcileBalance,
  reconcileAccountBalance
} from "./adjustment-service"
import { adjustAccountSchema, reconcileAccountSchema } from "./schemas"
import { ACCOUNT_NOT_FOUND } from "./service"
import type {
  AccountActionResult,
  AdjustAccountFormState,
  ReconcileFormState
} from "./types"

const ADJUST_FIELDS = ["balance", "occurred_time", "note"] as const

const RECONCILE_FIELDS = ["balance", "occurred_on"] as const

const idSchema = z.uuid()

// "Actualizar saldo": ajuste de hoy por la diferencia con el saldo real
export async function adjustAccountBalance(
  _prevState: AdjustAccountFormState,
  formData: FormData
): Promise<AdjustAccountFormState> {
  const values = readFormValues(formData, ADJUST_FIELDS)
  const accountId = idSchema.safeParse(formData.get("account_id"))

  if (!accountId.success) {
    return { error: ACCOUNT_NOT_FOUND, values }
  }

  const parsed = adjustAccountSchema.safeParse(values)
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await requireWritableWorkspace(formData.get("workspace_id"))
  const supabase = await createClient()
  const result = await createBalanceAdjustment(
    supabase,
    workspace,
    accountId.data,
    parsed.data
  )

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
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
  const result = await getReconcileBalance(
    workspace,
    parsedId.data,
    parsedOn.data
  )

  return result.ok ? { balance: result.balance } : { error: result.error }
}

// Conciliar (SPEC 21): ajuste a la fecha elegida por la diferencia con el
// saldo calculado a esa fecha
export async function reconcileAccountAction(
  _prevState: ReconcileFormState,
  formData: FormData
): Promise<ReconcileFormState> {
  const values = readFormValues(formData, RECONCILE_FIELDS)
  const accountId = idSchema.safeParse(formData.get("account_id"))

  if (!accountId.success) {
    return { error: ACCOUNT_NOT_FOUND, values }
  }

  const parsed = reconcileAccountSchema.safeParse(values)
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await requireWritableWorkspace(formData.get("workspace_id"))
  const supabase = await createClient()
  const result = await reconcileAccountBalance(
    supabase,
    workspace,
    accountId.data,
    parsed.data
  )

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
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
  const result = await deleteAdjustmentRecord(
    supabase,
    workspace,
    parsedId.data
  )

  if (!result.ok) {
    return { error: result.error }
  }

  revalidateWorkspacePages(workspace)
  return {}
}
