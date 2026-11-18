import type { PostgrestError } from "@supabase/supabase-js"
import {
  type ServiceFailure,
  type ServiceResult,
  type ServiceWorkspace,
  fail
} from "@/libs/service-result"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Database } from "@/types/database"
import { GOAL_NOT_FOUND } from "./contribution-service"
import type { GoalInput } from "./schemas"

// Crear y editar metas de ahorro (SPEC 44). Lo comparten las Server Actions
// y el MCP: recibe el cliente y el espacio Personal ya resuelto y devuelve la
// fila antes y después para el log. Los aportes van por
// contribution-service.ts.

export type GoalRow = Database["public"]["Tables"]["savings_goals"]["Row"]

const GOAL_DEFAULT_ERROR = "No se pudo guardar la meta. Intenta de nuevo"

// Errores de Postgres que pueden llegar pese a la validación con Zod
function goalPgError(error: PostgrestError): ServiceFailure {
  if (error.code === "42501") {
    return fail({ error: "No tienes permiso para modificar esta meta" })
  }
  // check de la tabla y el resto
  return fail({ error: GOAL_DEFAULT_ERROR })
}

export async function createGoalRecord(
  supabase: AppSupabase,
  workspace: Pick<ServiceWorkspace, "id">,
  data: GoalInput
): Promise<ServiceResult<{ after: GoalRow }>> {
  const { data: after, error } = await supabase
    .from("savings_goals")
    .insert({ ...data, workspace_id: workspace.id })
    .select("*")
    .single()

  if (error) {
    return goalPgError(error)
  }
  return { ok: true, after }
}

/** Meta del espacio por id, o null */
export async function loadGoalRow(
  supabase: AppSupabase,
  workspaceId: string,
  id: string
): Promise<GoalRow | null> {
  const { data } = await supabase
    .from("savings_goals")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  return data
}

/**
 * `data` es la meta completa ya validada con goalSchema(fecha guardada), que
 * deja conservar una fecha objetivo ya pasada.
 */
export async function updateGoalRecord(
  supabase: AppSupabase,
  workspace: Pick<ServiceWorkspace, "id">,
  id: string,
  data: GoalInput
): Promise<ServiceResult<{ before: GoalRow; after: GoalRow }>> {
  const before = await loadGoalRow(supabase, workspace.id, id)
  if (!before) {
    return fail({ error: GOAL_NOT_FOUND })
  }

  const { data: updated, error } = await supabase
    .from("savings_goals")
    .update(data)
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select("*")

  if (error) {
    return goalPgError(error)
  }
  const after = updated[0]
  if (!after) {
    return fail({ error: GOAL_NOT_FOUND })
  }
  return { ok: true, before, after }
}
