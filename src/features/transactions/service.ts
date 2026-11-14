import type { PostgrestError } from "@supabase/supabase-js"
import type { z } from "zod"
import type { IncomeAllocation } from "@/features/recurring-incomes/types"
import type { WorkspaceType } from "@/features/workspaces/queries"
import {
  type ServiceFailure,
  type ServiceResult,
  type ServiceWorkspace,
  fail
} from "@/libs/service-result"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Database } from "@/types/database"
import type { TransactionInput, createTransactionSchema } from "./schemas"

// Lógica de crear, editar y borrar movimientos (SPEC 34). La comparten las
// Server Actions (sesión de cookies) y el MCP (Bearer del agente). Recibe el
// cliente y un espacio ya resuelto y con permiso de escritura; no revalida
// rutas ni lee FormData. Devuelve las filas antes y después para el log de
// operaciones del MCP.

export type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"]

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

export const NOT_FOUND = "No se encontró el movimiento"
const DEFAULT_ERROR = "No se pudo guardar el movimiento. Intenta de nuevo"
const DELETE_ERROR = "No se pudo eliminar el movimiento. Intenta de nuevo"
const INVALID_CATEGORY = "Elige una categoría válida para este tipo"
const ARCHIVED_CATEGORY = "Esta categoría está archivada. Elige otra"
const RECURRING_NOT_FOUND = "No se encontró el gasto fijo"
const ALREADY_PAID = "Este pago ya está registrado"
const RECURRING_MUST_BE_EXPENSE = "El pago de un gasto fijo debe ser un gasto"
const ARCHIVED_ACCOUNT = "La cuenta está archivada"
const INVALID_ACCOUNT = "Elige una cuenta válida"
const SAME_TRANSFER_ACCOUNT = "Elige una cuenta distinta a la que paga"
const INCOME_NOT_FOUND = "No se encontró el ingreso fijo"
export const LINKED_DEBT_ENTRY =
  "Este movimiento es un pago o avance de deuda: edítalo desde su diálogo de pago"
const UNIQUE_VIOLATION = "23505"

// Códigos de Postgres que pueden llegar pese a la validación con Zod
const PG_ERROR_MESSAGES: Record<string, Omit<ServiceFailure, "ok">> = {
  // check_transaction_category y los check de la tabla
  "23514": { fieldErrors: { category_id: [INVALID_CATEGORY] } },
  // FK de category_id
  "23503": { fieldErrors: { category_id: [INVALID_CATEGORY] } },
  // RLS
  "42501": { error: "No tienes permiso para modificar este movimiento" }
}

// allocate_income_receipt marca con `hint` por qué sobró monto al repartir
// (SPEC 38); el mensaje va al campo del monto
const ALLOCATION_HINTS = new Set([
  "allocation_future_limit",
  "allocation_exceeds_end"
])

function toServiceError(error: PostgrestError): ServiceFailure {
  if (ALLOCATION_HINTS.has(error.hint)) {
    return fail({ fieldErrors: { amount: [error.message] } })
  }
  // Índice único por ocurrencia: el pago ya existe (p. ej. doble clic)
  if (error.code === UNIQUE_VIOLATION) {
    return fail({ error: ALREADY_PAID })
  }
  // check_account_active y la FK compuesta de la cuenta, antes que los
  // códigos genéricos de la categoría
  if (error.message.includes(ARCHIVED_ACCOUNT)) {
    return fail({ fieldErrors: { account_id: [ARCHIVED_ACCOUNT] } })
  }
  if (error.code === "23503" && error.message.includes("account_id")) {
    return fail({ fieldErrors: { account_id: [INVALID_ACCOUNT] } })
  }
  // El traspaso desde la misma cuenta que paga lo frena transfers_check
  if (error.message.includes("transfers_check")) {
    return fail({ fieldErrors: { transfer_from: [SAME_TRANSFER_ACCOUNT] } })
  }
  return fail(PG_ERROR_MESSAGES[error.code] ?? { error: DEFAULT_ERROR })
}

// Contraparte y factura solo existen en Empresa
function workspaceFields<
  T extends { counterparty: unknown; invoice_ref: unknown }
>(data: T, type: WorkspaceType): T {
  return type === "business"
    ? data
    : { ...data, counterparty: null, invoice_ref: null }
}

// El gasto fijo debe ser del espacio y la ocurrencia no debe tener pago. El
// trigger y el índice único lo garantizan en la BD; esto da un mensaje claro
// antes de insertar.
async function validateRecurring(
  supabase: AppSupabase,
  workspaceId: string,
  recurringExpenseId: string,
  dueOn: string
): Promise<string | null> {
  const { data: expense } = await supabase
    .from("recurring_expenses")
    .select("id")
    .eq("id", recurringExpenseId)
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  if (!expense) {
    return RECURRING_NOT_FOUND
  }

  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("recurring_expense_id", recurringExpenseId)
    .eq("recurring_due_on", dueOn)

  return (count ?? 0) > 0 ? ALREADY_PAID : null
}

interface IncomeLink {
  recurring_income_id: string | null
}

const NO_INCOME_LINK: IncomeLink = { recurring_income_id: null }

// Enlace de un ingreso a un ingreso fijo activo del espacio (SPEC 30). El
// reparto entre ocurrencias (SPEC 38) lo hace la BD: el trigger de
// transactions llama a allocate_income_receipt en la misma transacción que
// guarda el movimiento. El cliente nunca elige las ocurrencias.
async function resolveIncomeLink(
  supabase: AppSupabase,
  workspaceId: string,
  recurringIncomeId: string
): Promise<IncomeLink | { error: string }> {
  const { data: income } = await supabase
    .from("recurring_incomes")
    .select("id")
    .eq("id", recurringIncomeId)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .maybeSingle()

  return income
    ? { recurring_income_id: income.id }
    : { error: INCOME_NOT_FOUND }
}

/** Reparto guardado de un ingreso, de la ocurrencia más antigua a la última */
async function fetchAllocations(
  supabase: AppSupabase,
  transaction: TransactionRow
): Promise<IncomeAllocation[]> {
  if (transaction.recurring_income_id === null) {
    return []
  }
  const { data } = await supabase
    .from("recurring_income_allocations")
    .select("due_on, amount")
    .eq("transaction_id", transaction.id)
    .order("due_on")
  return data ?? []
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
