import "server-only"
import type { PostgrestError } from "@supabase/supabase-js"
import {
  type ServiceFailure,
  type ServiceResult,
  type ServiceWorkspace,
  fail
} from "@/features/workspaces/service-result"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Database } from "@/types/database"
import type { RecurringIncomeInput } from "./schemas"

// Crear y editar ingresos fijos (SPEC 44). Lo comparten las Server Actions y
// el MCP: recibe el cliente y el espacio Personal ya resuelto (con permiso
// de escritura) y devuelve la fila antes y después para el log.

export type RecurringIncomeRow =
  Database["public"]["Tables"]["recurring_incomes"]["Row"]

export const RECURRING_INCOME_NOT_FOUND = "No se encontró el ingreso fijo"
const DEFAULT_ERROR = "No se pudo guardar el ingreso fijo. Intenta de nuevo"
const INVALID_CATEGORY = "Elige una categoría de entrada"
const ARCHIVED_CATEGORY = "Esta categoría está archivada. Elige otra"
const INVALID_ACCOUNT = "Elige una cuenta válida"
const ARCHIVED_ACCOUNT = "Esta cuenta está archivada. Elige otra"

// Códigos de Postgres que pueden llegar pese a la validación con Zod
function pgError(error: PostgrestError): ServiceFailure {
  // FK de category_id o account_id
  if (error.code === "23503") {
    return fail({ fieldErrors: { category_id: [INVALID_CATEGORY] } })
  }
  if (error.code === "42501") {
    return fail({
      error: "No tienes permiso para modificar este ingreso fijo"
    })
  }
  // check_recurring_income, los check de la tabla y el resto
  return fail({ error: DEFAULT_ERROR })
}

/**
 * La categoría debe existir, ser visible para el usuario (RLS), ser de
 * ingreso y estar activa. La cuenta, si llega, debe ser del espacio y estar
 * activa.
 */
async function referenceErrors(
  supabase: AppSupabase,
  workspaceId: string,
  data: Pick<RecurringIncomeInput, "category_id" | "account_id">
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

  if (!category || category.type !== "income") {
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

export async function createRecurringIncomeRecord(
  supabase: AppSupabase,
  workspace: Pick<ServiceWorkspace, "id">,
  data: RecurringIncomeInput
): Promise<ServiceResult<{ after: RecurringIncomeRow }>> {
  const invalid = await referenceErrors(supabase, workspace.id, data)
  if (invalid) {
    return invalid
  }

  const { data: after, error } = await supabase
    .from("recurring_incomes")
    .insert({ ...data, workspace_id: workspace.id })
    .select("*")
    .single()

  if (error) {
    return pgError(error)
  }
  return { ok: true, after }
}

/** Ingreso fijo del espacio por id, o null */
export async function loadRecurringIncome(
  supabase: AppSupabase,
  workspaceId: string,
  id: string
): Promise<RecurringIncomeRow | null> {
  const { data } = await supabase
    .from("recurring_incomes")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  return data
}

/** `data` es el ingreso fijo completo ya validado con recurringIncomeSchema */
export async function updateRecurringIncomeRecord(
  supabase: AppSupabase,
  workspace: Pick<ServiceWorkspace, "id">,
  id: string,
  data: RecurringIncomeInput
): Promise<
  ServiceResult<{ before: RecurringIncomeRow; after: RecurringIncomeRow }>
> {
  const before = await loadRecurringIncome(supabase, workspace.id, id)
  if (!before) {
    return fail({ error: RECURRING_INCOME_NOT_FOUND })
  }

  const invalid = await referenceErrors(supabase, workspace.id, data)
  if (invalid) {
    return invalid
  }

  const { data: updated, error } = await supabase
    .from("recurring_incomes")
    .update(data)
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select("*")

  if (error) {
    return pgError(error)
  }
  const after = updated[0]
  if (!after) {
    return fail({ error: RECURRING_INCOME_NOT_FOUND })
  }
  return { ok: true, before, after }
}
