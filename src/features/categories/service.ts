import "server-only"
import type { PostgrestError } from "@supabase/supabase-js"
import {
  type ServiceFailure,
  type ServiceResult,
  type ServiceWorkspace,
  fail
} from "@/features/workspaces/service-result"
import { moveErrorMessage } from "@/libs/move-error"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Category } from "./queries"
import type { CategoryInput } from "./schemas"

// Escrituras de categorías propias. Crear (SPEC 34) lo comparten la action y
// el MCP; editar, archivar y reordenar, solo las actions.

/** Error del campo `name` con un nombre que ya usa otra categoría del tipo */
export const DUPLICATE_NAME =
  "Ya tienes una categoría de este tipo con ese nombre"
/** Error cuando la categoría no existe o no es del espacio */
export const NOT_FOUND = "No se encontró la categoría"
const DEFAULT_ERROR = "No se pudo guardar la categoría. Intenta de nuevo"
const UNIQUE_VIOLATION = "23505"

// Índice único categories_unique_name (espacio, tipo, nombre)
function categoryPgError(error: PostgrestError): ServiceFailure {
  return error.code === UNIQUE_VIOLATION
    ? fail({ fieldErrors: { name: [DUPLICATE_NAME] } })
    : fail({ error: DEFAULT_ERROR })
}

/** Crea una categoría propia del espacio */
export async function createCategoryRecord(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  data: CategoryInput
): Promise<ServiceResult<{ after: Category }>> {
  const { data: category, error } = await supabase
    .from("categories")
    .insert({ ...data, workspace_id: workspace.id })
    .select("*")
    .single()

  if (error) {
    return categoryPgError(error)
  }
  return { ok: true, after: category }
}

/**
 * Edita nombre, icono y color de una categoría propia. El tipo no se cambia:
 * los movimientos de la categoría dependen de él
 */
export async function updateCategoryRecord(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  id: string,
  data: Omit<CategoryInput, "type">
): Promise<ServiceResult<object>> {
  const { data: updated, error } = await supabase
    .from("categories")
    .update(data)
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return categoryPgError(error)
  }
  if (updated.length === 0) {
    return fail({ error: NOT_FOUND })
  }
  return { ok: true }
}

/**
 * Archiva (`archived: true`) o restaura una categoría propia. El índice
 * único también cubre las archivadas, así que restaurar nunca duplica un
 * nombre
 */
export async function setCategoryArchived(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  id: string,
  archived: boolean
): Promise<ServiceResult<object>> {
  const { data, error } = await supabase
    .from("categories")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return fail({
      error: archived
        ? "No se pudo archivar la categoría. Intenta de nuevo"
        : "No se pudo restaurar la categoría. Intenta de nuevo"
    })
  }
  if (data.length === 0) {
    return fail({ error: NOT_FOUND })
  }
  return { ok: true }
}

/**
 * Reordena las categorías propias activas de un tipo (SPEC 45): la categoría
 * toma el lugar de la destino. Los selects siguen este orden
 */
export async function moveCategoryRecord(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  id: string,
  targetId: string
): Promise<ServiceResult<object>> {
  const { error } = await supabase.rpc("move_category", {
    p_workspace_id: workspace.id,
    p_id: id,
    p_target_id: targetId
  })

  if (error) {
    return fail({ error: moveErrorMessage(error) })
  }
  return { ok: true }
}
