import {
  type ServiceResult,
  type ServiceWorkspace,
  fail
} from "@/libs/service-result"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Category } from "./queries"
import type { CategoryInput } from "./schemas"

// Crear una categoría propia (SPEC 34). Lo comparten la action y el MCP.

export const DUPLICATE_NAME =
  "Ya tienes una categoría de este tipo con ese nombre"
const DEFAULT_ERROR = "No se pudo guardar la categoría. Intenta de nuevo"
const UNIQUE_VIOLATION = "23505"

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
    // Índice único categories_unique_name (espacio, tipo, nombre)
    return error.code === UNIQUE_VIOLATION
      ? fail({ fieldErrors: { name: [DUPLICATE_NAME] } })
      : fail({ error: DEFAULT_ERROR })
  }
  return { ok: true, after: category }
}
