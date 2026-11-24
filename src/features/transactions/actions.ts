"use server"

import { z } from "zod"
import { requireWritableWorkspace } from "@/features/workspaces/queries"
import { revalidateWorkspacePages } from "@/features/workspaces/revalidate"
import type { ServiceFailure } from "@/features/workspaces/service-result"
import { readFormValues } from "@/libs/form-data"
import { createClient } from "@/libs/supabase/server"
import { getEditableTransaction } from "./queries"
import {
  createTransactionSchema,
  parseAmount,
  transactionSchema
} from "./schemas"
import {
  createTransactionRecord,
  deleteTransactionRecord,
  updateTransactionRecord
} from "./service"
import { NOT_FOUND } from "./transaction-errors"
import type {
  EditableTransaction,
  TransactionActionResult,
  TransactionFormState
} from "./types"

// Las reglas de crear, editar y borrar viven en service.ts (SPEC 34). Aquí
// solo se lee el FormData, se valida con Zod, se resuelve el espacio y se
// revalidan las páginas. Reordenar y Verificar van en ledger-actions.ts;
// duplicar, en duplicate-actions.ts.

const FIELDS = [
  "type",
  "amount",
  "occurred_on",
  "occurred_time",
  "category_id",
  "description",
  "note",
  "account_id",
  "counterparty",
  "invoice_ref",
  "recurring_expense_id",
  "recurring_due_on",
  "recurring_income_id",
  "transfer_from",
  "transfer_amount"
] as const

const idSchema = z.uuid()

function parseForm<T>(
  formData: FormData,
  schema: z.ZodType<T, unknown>
): { values: Record<string, string>; parsed: z.ZodSafeParseResult<T> } {
  const values = readFormValues(formData, FIELDS)
  const parsed = schema.safeParse({
    ...values,
    amount: parseAmount(values.amount)
  })
  return { values, parsed }
}

function toValidationError(
  error: z.ZodError,
  values: Record<string, string>
): TransactionFormState {
  const { formErrors, fieldErrors } = z.flattenError(error)
  return { error: formErrors[0], fieldErrors, values }
}

function toFormState(
  { error, fieldErrors }: ServiceFailure,
  values: Record<string, string>
): TransactionFormState {
  return { error, fieldErrors, values }
}

export async function createTransaction(
  _prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  const { values, parsed } = parseForm(formData, createTransactionSchema)

  if (!parsed.success) {
    return toValidationError(parsed.error, values)
  }

  const workspace = await requireWritableWorkspace(formData.get("workspace_id"))
  const supabase = await createClient()
  const result = await createTransactionRecord(supabase, workspace, parsed.data)

  if (!result.ok) {
    return toFormState(result, values)
  }

  revalidateWorkspacePages(workspace)
  return { ok: true, allocations: result.allocations }
}

export async function updateTransaction(
  _prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  // transactionSchema no incluye el enlace al gasto fijo: editar lo conserva.
  // El de ingreso fijo sí se puede cambiar (SPEC 30)
  const { values, parsed } = parseForm(formData, transactionSchema)
  const id = idSchema.safeParse(formData.get("id"))

  if (!id.success) {
    return { error: NOT_FOUND, values }
  }
  if (!parsed.success) {
    return toValidationError(parsed.error, values)
  }

  const workspace = await requireWritableWorkspace(formData.get("workspace_id"))
  const supabase = await createClient()
  const result = await updateTransactionRecord(supabase, workspace, id.data, {
    ...parsed.data,
    // Sin el campo (formularios sin select) el enlace se conserva
    recurring_income_id: formData.has("recurring_income_id")
      ? parsed.data.recurring_income_id
      : undefined
  })

  if (!result.ok) {
    return toFormState(result, values)
  }

  revalidateWorkspacePages(workspace)
  return { ok: true, allocations: result.allocations }
}

export async function deleteTransaction(
  workspaceId: string,
  id: string
): Promise<TransactionActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: NOT_FOUND }
  }

  const workspace = await requireWritableWorkspace(workspaceId)
  const supabase = await createClient()
  const result = await deleteTransactionRecord(
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

// Un pago o cobro ya registrado para editarlo desde el Sheet de su gasto o
// ingreso fijo (SPEC 42). Solo lectura: RLS limita las filas al dueño.
export async function loadEditableTransaction(
  workspaceId: string,
  id: string
): Promise<{ transaction: EditableTransaction } | { error: string }> {
  const parsedWorkspace = idSchema.safeParse(workspaceId)
  const parsedId = idSchema.safeParse(id)

  if (!parsedWorkspace.success || !parsedId.success) {
    return { error: NOT_FOUND }
  }

  try {
    const transaction = await getEditableTransaction(
      parsedWorkspace.data,
      parsedId.data
    )
    return transaction ? { transaction } : { error: NOT_FOUND }
  } catch {
    return { error: "No se pudo cargar el movimiento. Intenta de nuevo" }
  }
}
