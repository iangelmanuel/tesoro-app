import type { PostgrestError } from "@supabase/supabase-js"
import {
  type ServiceFailure,
  type ServiceResult,
  type ServiceWorkspace,
  fail
} from "@/features/workspaces/service-result"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Database } from "@/types/database"
import type { RecurringExpenseInput } from "./schemas"

// Crear y editar gastos fijos (SPEC 44). Lo comparten las Server Actions y
// el MCP: recibe el cliente y el espacio Personal ya resuelto y devuelve la
// fila antes y después para el log.

export type RecurringExpenseRow =
  Database["public"]["Tables"]["recurring_expenses"]["Row"]

export const RECURRING_EXPENSE_NOT_FOUND = "No se encontró el gasto fijo"
const DEFAULT_ERROR = "No se pudo guardar el gasto fijo. Intenta de nuevo"
const INVALID_CATEGORY = "Elige una categoría de salida"
const ARCHIVED_CATEGORY = "Esta categoría está archivada. Elige otra"
const INVALID_ACCOUNT = "Elige una cuenta de tu espacio"
const ARCHIVED_ACCOUNT = "Esta cuenta está archivada. Elige otra"

// Códigos de Postgres que pueden llegar pese a la validación con Zod
function pgError(error: PostgrestError): ServiceFailure {
  // check_expense_category y los check de la tabla
  if (error.code === "23514") {
    return fail({ fieldErrors: { category_id: [INVALID_CATEGORY] } })
  }
  if (error.code === "42501") {
    return fail({ error: "No tienes permiso para modificar este gasto fijo" })
  }
  // FK de category_id o account_id, y el resto
  return fail({ error: DEFAULT_ERROR })
}

/**
 * La categoría debe existir, ser visible para el usuario (RLS), ser de gasto
 * y estar activa. La cuenta por defecto, si llega, debe ser del espacio y estar
 * activa (SPEC 41).
 */
async function referenceErrors(
  supabase: AppSupabase,
  workspaceId: string,
  data: Pick<RecurringExpenseInput, "category_id" | "account_id">
): Promise<ServiceFailure | null> {
  const [{ data: category }, account] = await Promise.all([
    supabase
      .from("categories")
      .select("type, archived_at")
      .eq("id", data.category_id)
      .maybeSingle(),
    data.account_id === null
      ? Promise.resolve(null)
      : supabase
          .from("accounts")
          .select("archived_at")
          .eq("id", data.account_id)
          .eq("workspace_id", workspaceId)
          .maybeSingle()
  ])

  if (!category || category.type !== "expense") {
    return fail({ fieldErrors: { category_id: [INVALID_CATEGORY] } })
  }
  if (category.archived_at !== null) {
    return fail({ fieldErrors: { category_id: [ARCHIVED_CATEGORY] } })
  }
  if (account !== null) {
    if (!account.data) {
      return fail({ fieldErrors: { account_id: [INVALID_ACCOUNT] } })
    }
    if (account.data.archived_at !== null) {
      return fail({ fieldErrors: { account_id: [ARCHIVED_ACCOUNT] } })
    }
  }
  return null
}

export async function createRecurringExpenseRecord(
  supabase: AppSupabase,
  workspace: Pick<ServiceWorkspace, "id">,
  data: RecurringExpenseInput
): Promise<ServiceResult<{ after: RecurringExpenseRow }>> {
  const invalid = await referenceErrors(supabase, workspace.id, data)
  if (invalid) {
    return invalid
  }

  const { data: after, error } = await supabase
    .from("recurring_expenses")
    .insert({ ...data, workspace_id: workspace.id })
    .select("*")
    .single()

  if (error) {
    return pgError(error)
  }
  return { ok: true, after }
}

/** Gasto fijo del espacio por id, o null */
export async function loadRecurringExpense(
  supabase: AppSupabase,
  workspaceId: string,
  id: string
): Promise<RecurringExpenseRow | null> {
  const { data } = await supabase
    .from("recurring_expenses")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  return data
}

/** `data` es el gasto fijo completo ya validado con recurringExpenseSchema */
export async function updateRecurringExpenseRecord(
  supabase: AppSupabase,
  workspace: Pick<ServiceWorkspace, "id">,
  id: string,
  data: RecurringExpenseInput
): Promise<
  ServiceResult<{ before: RecurringExpenseRow; after: RecurringExpenseRow }>
> {
  const before = await loadRecurringExpense(supabase, workspace.id, id)
  if (!before) {
    return fail({ error: RECURRING_EXPENSE_NOT_FOUND })
  }

  const invalid = await referenceErrors(supabase, workspace.id, data)
  if (invalid) {
    return invalid
  }

  const { data: updated, error } = await supabase
    .from("recurring_expenses")
    .update(data)
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select("*")

  if (error) {
    return pgError(error)
  }
  const after = updated[0]
  if (!after) {
    return fail({ error: RECURRING_EXPENSE_NOT_FOUND })
  }
  return { ok: true, before, after }
}
