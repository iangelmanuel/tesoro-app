import "server-only"
import {
  type ServiceResult,
  type ServiceWorkspace,
  fail
} from "@/features/workspaces/service-result"
import { currentMonth } from "@/libs/dates"
import type { AppSupabase } from "@/libs/supabase/types"

// Recomendaciones ocultas (SPEC 07): una fila de dismissed_recommendations por
// espacio, regla, entidad y mes. Reciben el cliente y el espacio ya resuelto
// con permiso de escritura; la regla y la entidad llegan validadas.

/** Regla y entidad de una recomendación, ya validadas para el espacio */
interface DismissedKey {
  rule: string
  entityKey: string
}

const UNIQUE_VIOLATION = "23505"

/** Primer día (YYYY-MM-DD) del mes actual, como lo guarda la tabla */
function currentMonthStart() {
  return `${currentMonth()}-01`
}

/**
 * "Ocultar este mes". Si ya estaba oculta (doble clic, otra pestaña) no es
 * un error.
 */
export async function dismissRecommendationRecord(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  key: DismissedKey
): Promise<ServiceResult<object>> {
  const { error } = await supabase.from("dismissed_recommendations").insert({
    workspace_id: workspace.id,
    rule: key.rule,
    entity_key: key.entityKey,
    month: currentMonthStart()
  })

  if (error && error.code !== UNIQUE_VIOLATION) {
    return fail({
      error: "No se pudo ocultar la recomendación. Intenta de nuevo"
    })
  }
  return { ok: true }
}

/** "Mostrar de nuevo": borra la fila del mes actual */
export async function restoreRecommendationRecord(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  key: DismissedKey
): Promise<ServiceResult<object>> {
  const { error } = await supabase
    .from("dismissed_recommendations")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("rule", key.rule)
    .eq("entity_key", key.entityKey)
    .eq("month", currentMonthStart())

  if (error) {
    return fail({
      error: "No se pudo mostrar la recomendación. Intenta de nuevo"
    })
  }
  return { ok: true }
}
