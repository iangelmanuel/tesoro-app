"use server"

import { z } from "zod"
import { occurrenceDescription } from "@/features/recurring-expenses/occurrences"
import { nextUnpaidOccurrence } from "@/features/recurring-expenses/payment"
import { getRecurringExpenseOccurrences } from "@/features/recurring-expenses/queries"
import { getIncomeSources } from "@/features/recurring-incomes/queries"
import { incomeReceiptDescription } from "@/features/recurring-incomes/receipt"
import { requireWritableWorkspace } from "@/features/workspaces/queries"
import { revalidateWorkspacePages } from "@/features/workspaces/revalidate"
import type { ServiceFailure } from "@/features/workspaces/service-result"
import { monthRange, shiftMonth } from "@/libs/dates"
import { createClient } from "@/libs/supabase/server"
import type {
  RecurringOccurrenceLink,
  TransactionInitialValues
} from "./components/transaction-dialog"
import {
  type EditableTransaction,
  type VerifyEntry,
  getEditableTransaction,
  getVerifyEntries
} from "./queries"
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

const DUPLICATE_ERROR = "No se pudo preparar el duplicado. Intenta de nuevo"
const NO_PENDING_OCCURRENCE =
  "Este gasto fijo no tiene periodos pendientes de pago"

// Cuánto hacia adelante se buscan ocurrencias sin pagar: cubre el siguiente
// periodo de un gasto anual aunque ya esté pagado el de después
const DUPLICATE_HORIZON_MONTHS = 24

const NO_OPEN_INCOME_PERIOD =
  "Este ingreso fijo no tiene periodos pendientes de cobro"

/**
 * Cobro de ingreso fijo: el duplicado lleva el mismo ingreso fijo y la BD lo
 * reparte con la regla de SPEC 38 (periodo abierto más antiguo). Sin periodo
 * abierto, o si el ingreso fijo ya no está activo, no se duplica. "Sin fecha
 * fija" no tiene periodos: se enlaza tal cual
 */
async function incomeDuplicate(
  workspaceId: string,
  recurringIncomeId: string,
  initialValues: TransactionInitialValues
) {
  const sources = await getIncomeSources(workspaceId)
  const source = sources.find((option) => option.id === recurringIncomeId)

  if (!source) {
    return { error: NO_OPEN_INCOME_PERIOD }
  }

  const values = { ...initialValues, recurring_income_id: source.id }
  if (source.frequency === "none") {
    return { initialValues: values }
  }
  if (!source.periods.some((period) => period.due > 0)) {
    return { error: NO_OPEN_INCOME_PERIOD }
  }

  // La descripción nombra el periodo que se cubre, no el del original
  return {
    initialValues: {
      ...values,
      description: incomeReceiptDescription(source)
    }
  }
}

async function nextRecurringOccurrence(
  supabase: Awaited<ReturnType<typeof createClient>>,
  transactionId: string,
  recurringExpenseId: string
) {
  const { data, error } = await supabase
    .from("transactions")
    .select("recurring_due_on")
    .eq("id", transactionId)
    .single()

  if (error || !data.recurring_due_on) {
    throw new Error(DUPLICATE_ERROR)
  }

  const afterDueOn = data.recurring_due_on
  const occurrences = await getRecurringExpenseOccurrences(
    recurringExpenseId,
    afterDueOn,
    monthRange(shiftMonth(afterDueOn.slice(0, 7), DUPLICATE_HORIZON_MONTHS)).to
  )
  return nextUnpaidOccurrence(occurrences, recurringExpenseId, afterDueOn)
}

/**
 * Valores del duplicado de un movimiento suelto o de un pago de fijo (SPEC
 * 49). Copia tipo, monto, categoría, cuenta, descripción, nota y contraparte.
 * Sin fecha (el diálogo pone hoy), hora, factura ni posición del día. La
 * cuenta y la categoría archivadas quedan vacías. Solo lectura: RLS limita
 * las filas al dueño.
 */
export async function loadTransactionDuplicate(
  workspaceId: string,
  transactionId: string
): Promise<
  | {
      initialValues: TransactionInitialValues
      recurring?: RecurringOccurrenceLink
    }
  | { error: string }
> {
  const parsedWorkspace = idSchema.safeParse(workspaceId)
  const parsedId = idSchema.safeParse(transactionId)

  if (!parsedWorkspace.success || !parsedId.success) {
    return { error: NOT_FOUND }
  }

  try {
    const original = await getEditableTransaction(
      parsedWorkspace.data,
      parsedId.data
    )
    if (!original) {
      return { error: NOT_FOUND }
    }

    const supabase = await createClient()
    const [category, account] = await Promise.all([
      supabase
        .from("categories")
        .select("id")
        .eq("id", original.category_id)
        .is("archived_at", null)
        .maybeSingle(),
      original.account_id
        ? supabase
            .from("accounts")
            .select("id")
            .eq("id", original.account_id)
            .eq("workspace_id", parsedWorkspace.data)
            .is("archived_at", null)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ])
    if (category.error || account.error) {
      return { error: DUPLICATE_ERROR }
    }

    const initialValues: TransactionInitialValues = {
      type: original.type,
      amount: original.amount,
      category_id: category.data?.id,
      account_id: account.data?.id ?? null,
      description: original.description,
      note: original.note ?? "",
      counterparty: original.counterparty
    }

    if (original.recurring_income_id !== null) {
      return incomeDuplicate(
        parsedWorkspace.data,
        original.recurring_income_id,
        initialValues
      )
    }

    if (original.recurring_expense_id === null) {
      return { initialValues }
    }

    // Pago de gasto fijo: el duplicado paga la primera ocurrencia sin pagar
    // posterior a la del original, nunca la misma
    const next = await nextRecurringOccurrence(
      supabase,
      original.id,
      original.recurring_expense_id
    )
    if (!next) {
      return { error: NO_PENDING_OCCURRENCE }
    }

    return {
      // La descripción nombra el periodo que se paga, no el del original
      initialValues: {
        ...initialValues,
        description: occurrenceDescription(next)
      },
      recurring: {
        recurringExpenseId: next.recurringExpenseId,
        dueOn: next.dueOn
      }
    }
  } catch {
    return { error: DUPLICATE_ERROR }
  }
}

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
