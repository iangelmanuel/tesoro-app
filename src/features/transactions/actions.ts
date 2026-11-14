"use server"

import { z } from "zod"
import { requireWritableWorkspace } from "@/features/workspaces/queries"
import { revalidateWorkspacePages } from "@/libs/revalidate"
import type { ServiceFailure } from "@/libs/service-result"
import { createClient } from "@/libs/supabase/server"
import { type VerifyEntry, getVerifyEntries } from "./queries"
import {
  createTransactionSchema,
  parseAmount,
  transactionSchema
} from "./schemas"
import {
  NOT_FOUND,
  createTransactionRecord,
  deleteTransactionRecord,
  updateTransactionRecord
} from "./service"
import type { TransactionActionResult, TransactionFormState } from "./types"

// Las reglas de crear, editar y borrar viven en service.ts (SPEC 34). Aquí
// solo se lee el FormData, se valida con Zod, se resuelve el espacio y se
// revalidan las páginas.

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

function readValues(formData: FormData) {
  return Object.fromEntries(
    FIELDS.map((key) => {
      const value = formData.get(key)
      return [key, typeof value === "string" ? value : ""]
    })
  ) as Record<(typeof FIELDS)[number], string>
}

function parseForm<T>(
  formData: FormData,
  schema: z.ZodType<T, unknown>
): { values: Record<string, string>; parsed: z.ZodSafeParseResult<T> } {
  const values = readValues(formData)
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

const LEDGER_KINDS = [
  "income",
  "expense",
  "transfer",
  "adjustment",
  "debt_payment",
  "debt_advance",
  "goal_contribution"
] as const

const moveSchema = z.object({
  kind: z.enum(LEDGER_KINDS),
  id: z.uuid(),
  targetKind: z.enum(LEDGER_KINDS),
  targetId: z.uuid()
})

const MOVE_DEFAULT_ERROR = "No se pudo reordenar el movimiento"
const MOVE_FORBIDDEN = "No tienes permiso para reordenar en este espacio"
const MOVE_OTHER_DAY = "Solo se puede reordenar dentro del mismo día"

// Mueve una fila a la posición de otra del mismo día. Cubre movimientos,
// traspasos, ajustes, pagos de tarjeta, avances y aportes: el orden es el de
// la lista unificada (SPEC 19).
export async function moveLedgerEntry(
  workspaceId: string,
  kind: string,
  id: string,
  targetKind: string,
  targetId: string
): Promise<TransactionActionResult> {
  const parsed = moveSchema.safeParse({ kind, id, targetKind, targetId })

  if (!parsed.success) {
    return { error: NOT_FOUND }
  }

  const workspace = await requireWritableWorkspace(workspaceId)
  const supabase = await createClient()
  const { error } = await supabase.rpc("move_ledger_entry", {
    p_workspace_id: workspace.id,
    p_kind: parsed.data.kind,
    p_id: parsed.data.id,
    p_target_kind: parsed.data.targetKind,
    p_target_id: parsed.data.targetId
  })

  if (error) {
    if (error.code === "42501") {
      return { error: MOVE_FORBIDDEN }
    }
    if (error.message.includes("mismo día")) {
      return { error: MOVE_OTHER_DAY }
    }
    return { error: MOVE_DEFAULT_ERROR }
  }

  revalidateWorkspacePages(workspace)
  return {}
}

const verifySchema = z.object({
  workspaceId: z.uuid(),
  accountId: z.uuid().nullable(),
  offset: z.number().int().min(0).max(100_000)
})

// Página de Verificar movimientos. Solo lectura: RLS limita las filas al dueño
// del espacio, así que no hace falta resolver el espacio con permiso de
// escritura.
export async function loadVerifyEntries(
  workspaceId: string,
  accountId: string | null,
  offset: number
): Promise<{ rows: VerifyEntry[]; hasMore: boolean } | { error: string }> {
  const parsed = verifySchema.safeParse({ workspaceId, accountId, offset })

  if (!parsed.success) {
    return { error: "No se pudieron cargar los movimientos" }
  }

  try {
    return await getVerifyEntries(parsed.data.workspaceId, {
      accountId: parsed.data.accountId ?? undefined,
      offset: parsed.data.offset
    })
  } catch {
    return { error: "No se pudieron cargar los movimientos" }
  }
}
