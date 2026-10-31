"use server"

import { z } from "zod"
import { BUSINESS_RULE_KEYS } from "@/features/business-score/constants"
import {
  type WorkspaceType,
  requireWritableWorkspace
} from "@/features/workspaces/queries"
import { currentMonth } from "@/libs/dates"
import { revalidateWorkspacePages } from "@/libs/revalidate"
import { createClient } from "@/libs/supabase/server"
import { RULE_KEYS } from "./constants"

export interface RecommendationActionResult {
  error?: string
}

const INVALID_RECOMMENDATION = "La recomendación no es válida"

const entityKeySchema = z.string().trim().min(1).max(100)

// Cada espacio solo acepta sus reglas: una de Personal sobre una empresa (o
// al revés) es un error de validación
const RECOMMENDATION_SCHEMAS: Record<
  WorkspaceType,
  z.ZodType<{ rule: string; entityKey: string }>
> = {
  personal: z.object({ rule: z.enum(RULE_KEYS), entityKey: entityKeySchema }),
  business: z.object({
    rule: z.enum(BUSINESS_RULE_KEYS),
    entityKey: entityKeySchema
  })
}

// "Ocultar este mes": una fila por espacio, regla, entidad y mes actual
export async function dismissRecommendation(
  workspaceId: string,
  rule: string,
  entityKey: string
): Promise<RecommendationActionResult> {
  const workspace = await requireWritableWorkspace(workspaceId)
  const parsed = RECOMMENDATION_SCHEMAS[workspace.type].safeParse({
    rule,
    entityKey
  })

  if (!parsed.success) {
    return { error: INVALID_RECOMMENDATION }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("dismissed_recommendations").insert({
    workspace_id: workspace.id,
    rule: parsed.data.rule,
    entity_key: parsed.data.entityKey,
    month: `${currentMonth()}-01`
  })

  // Ya estaba oculta este mes (doble clic, otra pestaña): no es un error
  if (error && error.code !== "23505") {
    return { error: "No se pudo ocultar la recomendación. Intenta de nuevo" }
  }

  revalidateWorkspacePages(workspace)
  return {}
}

// "Mostrar de nuevo": borra la fila del mes actual
export async function restoreRecommendation(
  workspaceId: string,
  rule: string,
  entityKey: string
): Promise<RecommendationActionResult> {
  const workspace = await requireWritableWorkspace(workspaceId)
  const parsed = RECOMMENDATION_SCHEMAS[workspace.type].safeParse({
    rule,
    entityKey
  })

  if (!parsed.success) {
    return { error: INVALID_RECOMMENDATION }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("dismissed_recommendations")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("rule", parsed.data.rule)
    .eq("entity_key", parsed.data.entityKey)
    .eq("month", `${currentMonth()}-01`)

  if (error) {
    return { error: "No se pudo mostrar la recomendación. Intenta de nuevo" }
  }

  revalidateWorkspacePages(workspace)
  return {}
}
