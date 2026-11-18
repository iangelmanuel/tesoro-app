import type { PostgrestError } from "@supabase/supabase-js"
import {
  type ServiceFailure,
  type ServiceResult,
  type ServiceWorkspace,
  fail
} from "@/libs/service-result"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Database } from "@/types/database"
import type { BudgetInput } from "./schemas"

// Crear o cambiar el presupuesto de una categoría en un mes (SPEC 44). Lo
// comparten la Server Action y el MCP: recibe el cliente y el espacio
// Personal ya resuelto y devuelve la fila antes (null si no existía) y
// después para el log.

export type BudgetRow = Database["public"]["Tables"]["budgets"]["Row"]

const DEFAULT_ERROR = "No se pudo guardar el presupuesto. Intenta de nuevo"
const INVALID_CATEGORY = "Elige una categoría de gasto"
const ARCHIVED_CATEGORY = "Esta categoría está archivada. Elige otra"

// Códigos de Postgres que pueden llegar pese a la validación con Zod
function pgError(error: PostgrestError): ServiceFailure {
  // check_expense_category, los check de la tabla y la FK de category_id
  if (error.code === "23514" || error.code === "23503") {
    return fail({ fieldErrors: { category_id: [INVALID_CATEGORY] } })
  }
  if (error.code === "42501") {
    return fail({ error: "No tienes permiso para modificar este presupuesto" })
  }
  return fail({ error: DEFAULT_ERROR })
}

/**
 * La categoría debe existir, ser visible para el usuario (RLS), ser de gasto
 * y estar activa
 */
async function categoryError(
  supabase: AppSupabase,
  categoryId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("categories")
    .select("type, archived_at")
    .eq("id", categoryId)
    .maybeSingle()

  if (!data || data.type !== "expense") {
    return INVALID_CATEGORY
  }
  if (data.archived_at !== null) {
    return ARCHIVED_CATEGORY
  }
  return null
}

/**
 * Crea el presupuesto de la categoría en el mes o, si ya existe, cambia su
 * monto (único por espacio, categoría y mes)
 */
export async function setBudgetRecord(
  supabase: AppSupabase,
  workspace: Pick<ServiceWorkspace, "id">,
  data: BudgetInput
): Promise<ServiceResult<{ before: BudgetRow | null; after: BudgetRow }>> {
  const invalid = await categoryError(supabase, data.category_id)
  if (invalid) {
    return fail({ fieldErrors: { category_id: [invalid] } })
  }

  const { data: before } = await supabase
    .from("budgets")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("category_id", data.category_id)
    .eq("month", data.month)
    .maybeSingle()

  const { data: after, error } = await supabase
    .from("budgets")
    .upsert(
      { ...data, workspace_id: workspace.id },
      { onConflict: "workspace_id,category_id,month" }
    )
    .select("*")
    .single()

  if (error) {
    return pgError(error)
  }
  return { ok: true, before, after }
}
