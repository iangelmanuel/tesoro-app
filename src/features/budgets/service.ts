import "server-only"
import type { PostgrestError } from "@supabase/supabase-js"
import {
  type ServiceFailure,
  type ServiceResult,
  type ServiceWorkspace,
  fail
} from "@/features/workspaces/service-result"
import { shiftMonth } from "@/libs/dates"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Database } from "@/types/database"
import { monthStart } from "./month"
import type { BudgetInput } from "./schemas"

// Escrituras de presupuestos (solo Personal). Crear o cambiar el de una
// categoría en un mes (SPEC 44) lo comparten la Server Action y el MCP:
// recibe el cliente y el espacio Personal ya resuelto y devuelve la fila
// antes (null si no existía) y después para el log.

/** Fila de `budgets` */
export type BudgetRow = Database["public"]["Tables"]["budgets"]["Row"]

/** Error cuando el presupuesto no existe o no es del espacio */
export const NOT_FOUND = "No se encontró el presupuesto"
const DEFAULT_ERROR = "No se pudo guardar el presupuesto. Intenta de nuevo"
const COPY_ERROR = "No se pudieron copiar los presupuestos. Intenta de nuevo"
const INVALID_CATEGORY = "Elige una categoría de salida"
const ARCHIVED_CATEGORY = "Esta categoría está archivada. Elige otra"
const CHECK_VIOLATION = "23514"
const FOREIGN_KEY_VIOLATION = "23503"
const INSUFFICIENT_PRIVILEGE = "42501"

// Códigos de Postgres que pueden llegar pese a la validación con Zod
function pgError(error: PostgrestError): ServiceFailure {
  // check_expense_category, los check de la tabla y la FK de category_id
  if (error.code === CHECK_VIOLATION || error.code === FOREIGN_KEY_VIOLATION) {
    return fail({ fieldErrors: { category_id: [INVALID_CATEGORY] } })
  }
  if (error.code === INSUFFICIENT_PRIVILEGE) {
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

/** Borra un presupuesto del espacio */
export async function deleteBudgetRecord(
  supabase: AppSupabase,
  workspace: Pick<ServiceWorkspace, "id">,
  id: string
): Promise<ServiceResult<object>> {
  const { data, error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return fail({
      error: "No se pudo eliminar el presupuesto. Intenta de nuevo"
    })
  }
  if (data.length === 0) {
    return fail({ error: NOT_FOUND })
  }
  return { ok: true }
}

/**
 * Copia al mes YYYY-MM los presupuestos del mes anterior que falten. Nunca
 * pisa montos ya definidos (on conflict do nothing) y omite las categorías
 * archivadas. Devuelve cuántos copió.
 */
export async function copyPreviousMonthBudgetRecords(
  supabase: AppSupabase,
  workspace: Pick<ServiceWorkspace, "id">,
  month: string
): Promise<ServiceResult<{ copied: number }>> {
  const { data: previous, error: readError } = await supabase
    .from("budgets")
    .select("category_id, amount, category:categories!inner (archived_at)")
    .eq("workspace_id", workspace.id)
    .eq("month", monthStart(shiftMonth(month, -1)))
    .is("category.archived_at", null)

  if (readError) {
    return fail({ error: COPY_ERROR })
  }
  if (previous.length === 0) {
    return { ok: true, copied: 0 }
  }

  const targetMonth = monthStart(month)
  const { data: inserted, error } = await supabase
    .from("budgets")
    .upsert(
      previous.map((budget) => ({
        workspace_id: workspace.id,
        category_id: budget.category_id,
        month: targetMonth,
        amount: budget.amount
      })),
      { onConflict: "workspace_id,category_id,month", ignoreDuplicates: true }
    )
    .select("id")

  if (error) {
    return fail({ error: COPY_ERROR })
  }
  return { ok: true, copied: inserted.length }
}
