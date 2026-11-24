import "server-only"
import type { z } from "zod"
import type { IncomeAllocation } from "@/features/recurring-incomes/types"
import {
  type ServiceResult,
  type ServiceWorkspace,
  fail
} from "@/features/workspaces/service-result"
import type { WorkspaceType } from "@/features/workspaces/types"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Database } from "@/types/database"
import type { TransactionInput, createTransactionSchema } from "./schemas"
import {
  ARCHIVED_CATEGORY,
  DEFAULT_ERROR,
  DELETE_ERROR,
  INVALID_CATEGORY,
  LINKED_DEBT_ENTRY,
  NOT_FOUND,
  RECURRING_MUST_BE_EXPENSE,
  toServiceError
} from "./transaction-errors"
import {
  type IncomeLink,
  NO_INCOME_LINK,
  fetchAllocations,
  resolveIncomeLink,
  validateRecurring
} from "./transaction-links"

// Lógica de crear, editar y borrar movimientos (SPEC 34). La comparten las
// Server Actions (sesión de cookies) y el MCP (Bearer del agente). Recibe el
// cliente y un espacio ya resuelto y con permiso de escritura; no revalida
// rutas ni lee FormData. Devuelve las filas antes y después para el log de
// operaciones del MCP.

/** Fila de `transactions` */
export type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"]

/** Datos validados para crear un movimiento */
export type CreateTransactionData = z.output<typeof createTransactionSchema>

/**
 * Datos de una edición. `recurring_income_id` en `undefined` conserva el
 * enlace al ingreso fijo (formularios sin ese select).
 */
export type UpdateTransactionData = Omit<
  TransactionInput,
  "recurring_income_id"
> & {
  recurring_income_id?: TransactionInput["recurring_income_id"]
}

// Contraparte y factura solo existen en Empresa
function workspaceFields<
  T extends { counterparty: unknown; invoice_ref: unknown }
>(data: T, type: WorkspaceType): T {
  return type === "business"
    ? data
    : { ...data, counterparty: null, invoice_ref: null }
}

/**
 * La categoría debe existir, ser visible para el usuario (RLS), tener el tipo
 * del movimiento y el scope del espacio, y estar activa. Una archivada solo se
 * acepta si ya era la categoría actual del movimiento que se edita.
 */
export async function validateCategory(
  supabase: AppSupabase,
  categoryId: string,
  type: string,
  scope: WorkspaceType,
  currentCategoryId?: string
): Promise<string | null> {
  const { data } = await supabase
    .from("categories")
    .select("type, scope, archived_at")
    .eq("id", categoryId)
    .maybeSingle()

  if (!data || data.type !== type || data.scope !== scope) {
    return INVALID_CATEGORY
  }
  if (data.archived_at !== null && categoryId !== currentCategoryId) {
    return ARCHIVED_CATEGORY
  }
  return null
}

async function fetchRow(
  supabase: AppSupabase,
  workspaceId: string,
  id: string
): Promise<TransactionRow | null> {
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  return data
}

/** Crea un movimiento con sus enlaces (gasto fijo, ingreso fijo, traspaso) */
export async function createTransactionRecord(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  data: CreateTransactionData
): Promise<
  ServiceResult<{ after: TransactionRow; allocations: IncomeAllocation[] }>
> {
  const { recurring_expense_id, recurring_due_on } = data
  if (recurring_expense_id !== null && data.type !== "expense") {
    return fail({ error: RECURRING_MUST_BE_EXPENSE })
  }

  const categoryError = await validateCategory(
    supabase,
    data.category_id,
    data.type,
    workspace.type
  )
  if (categoryError) {
    return fail({ fieldErrors: { category_id: [categoryError] } })
  }

  if (recurring_expense_id !== null && recurring_due_on !== null) {
    const recurringError = await validateRecurring(
      supabase,
      workspace.id,
      recurring_expense_id,
      recurring_due_on
    )
    if (recurringError) {
      return fail({ error: recurringError })
    }
  }

  const { transfer_from, transfer_amount, recurring_income_id, ...fields } =
    data
  const row = workspaceFields(fields, workspace.type)

  // Ingreso fijo: solo en ingresos de Personal; en otro caso se ignora
  let incomeLink = NO_INCOME_LINK
  if (
    recurring_income_id !== null &&
    row.type === "income" &&
    workspace.type === "personal"
  ) {
    const resolved = await resolveIncomeLink(
      supabase,
      workspace.id,
      recurring_income_id
    )
    if ("error" in resolved) {
      return fail({ error: resolved.error })
    }
    incomeLink = resolved
  }

  // Con traspaso, el traspaso y el movimiento se guardan juntos (RPC); sin
  // él basta el insert directo
  if (transfer_from !== null && row.account_id !== null) {
    const { data: id, error } = await supabase.rpc("record_transaction", {
      p_workspace_id: workspace.id,
      p_type: row.type,
      p_amount: row.amount,
      p_category_id: row.category_id,
      p_occurred_on: row.occurred_on,
      p_occurred_time: row.occurred_time ?? undefined,
      p_description: row.description,
      p_note: row.note ?? undefined,
      p_account_id: row.account_id,
      p_recurring_expense_id: row.recurring_expense_id ?? undefined,
      p_recurring_due_on: row.recurring_due_on ?? undefined,
      p_counterparty: row.counterparty ?? undefined,
      p_invoice_ref: row.invoice_ref ?? undefined,
      p_transfer_from: transfer_from,
      p_transfer_amount: transfer_amount ?? undefined
    })
    if (error) {
      return toServiceError(error)
    }
    const after = await fetchRow(supabase, workspace.id, id)
    return after
      ? { ok: true, after, allocations: [] }
      : fail({ error: DEFAULT_ERROR })
  }

  // Con ingreso fijo, el trigger reparte el monto; si sobra, el insert falla
  // entero y el error llega al campo del monto
  const { data: inserted, error } = await supabase
    .from("transactions")
    .insert({ ...row, ...incomeLink, workspace_id: workspace.id })
    .select("*")
    .single()

  if (error || !inserted) {
    return error ? toServiceError(error) : fail({ error: DEFAULT_ERROR })
  }
  return {
    ok: true,
    after: inserted,
    allocations: await fetchAllocations(supabase, inserted)
  }
}

/**
 * Edita un movimiento. El enlace al gasto fijo se conserva; el de ingreso
 * fijo se puede cambiar (SPEC 30). Un movimiento con abono enlazado se edita
 * desde su pago (SPEC 26) y aquí se rechaza.
 */
export async function updateTransactionRecord(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  id: string,
  data: UpdateTransactionData
): Promise<
  ServiceResult<{
    before: TransactionRow
    after: TransactionRow
    allocations: IncomeAllocation[]
  }>
> {
  const { data: current } = await supabase
    .from("transactions")
    .select("*, debt_entries(id)")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle()

  if (!current) {
    return fail({ error: NOT_FOUND })
  }
  // El abono manda sobre su movimiento (SPEC 26): editarlo aquí lo desfasaría
  const { debt_entries: debtEntry, ...before } = current
  if (debtEntry) {
    return fail({ error: LINKED_DEBT_ENTRY })
  }
  if (before.recurring_expense_id !== null && data.type !== "expense") {
    return fail({ error: RECURRING_MUST_BE_EXPENSE })
  }

  const categoryError = await validateCategory(
    supabase,
    data.category_id,
    data.type,
    workspace.type,
    before.category_id
  )
  if (categoryError) {
    return fail({ fieldErrors: { category_id: [categoryError] } })
  }

  // Enlace al ingreso fijo:
  // - un gasto, o Empresa, no lleva enlace;
  // - sin el campo o con la misma fuente, se conserva; si cambia el monto,
  //   el trigger reparte de nuevo desde la ocurrencia no recibida más
  //   antigua, sin contar lo que ya tenía asignado este movimiento;
  // - "Otro ingreso" lo quita y el trigger borra sus asignaciones: las
  //   ocurrencias vuelven a su estado calculado;
  // - otra fuente re-enlaza y el trigger reparte en ella.
  const { recurring_income_id, ...fields } = data
  let incomeLink: IncomeLink | null = null
  if (data.type !== "income" || workspace.type !== "personal") {
    incomeLink = before.recurring_income_id === null ? null : NO_INCOME_LINK
  } else if (
    recurring_income_id !== undefined &&
    recurring_income_id !== before.recurring_income_id
  ) {
    if (recurring_income_id === null) {
      incomeLink = NO_INCOME_LINK
    } else {
      const resolved = await resolveIncomeLink(
        supabase,
        workspace.id,
        recurring_income_id
      )
      if ("error" in resolved) {
        return fail({ error: resolved.error })
      }
      incomeLink = resolved
    }
  }

  const { data: updated, error } = await supabase
    .from("transactions")
    .update({
      ...workspaceFields(fields, workspace.type),
      ...(incomeLink ?? {})
    })
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select("*")

  if (error) {
    return toServiceError(error)
  }
  const after = updated[0]
  if (!after) {
    return fail({ error: NOT_FOUND })
  }
  return {
    ok: true,
    before,
    after,
    allocations: await fetchAllocations(supabase, after)
  }
}

/**
 * Borra un movimiento. Un pago de deuda se elimina con su abono
 * (deleteEntry): borrar solo el movimiento dejaría el abono contando en la
 * deuda (SPEC 26).
 */
export async function deleteTransactionRecord(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  id: string
): Promise<ServiceResult<{ before: TransactionRow }>> {
  const { data: link, error: linkError } = await supabase
    .from("debt_entries")
    .select("id")
    .eq("transaction_id", id)
    .maybeSingle()

  if (linkError) {
    return fail({ error: DELETE_ERROR })
  }
  if (link) {
    return fail({ error: LINKED_DEBT_ENTRY })
  }

  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select("*")

  if (error) {
    return fail({ error: DELETE_ERROR })
  }
  const before = data[0]
  if (!before) {
    return fail({ error: NOT_FOUND })
  }
  return { ok: true, before }
}
