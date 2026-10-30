"use server"

import { z } from "zod"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { currentMonth } from "@/libs/dates"
import { revalidatePersonalPages } from "@/libs/revalidate"
import { createClient } from "@/libs/supabase/server"
import { RULE_KEYS } from "./constants"

export interface RecommendationActionResult {
  error?: string
}

const INVALID_RECOMMENDATION = "La recomendación no es válida"

const recommendationSchema = z.object({
  rule: z.enum(RULE_KEYS),
  entityKey: z.string().trim().min(1).max(100)
})

// "Ocultar este mes": una fila por regla, entidad y mes actual
export async function dismissRecommendation(
  rule: string,
  entityKey: string
): Promise<RecommendationActionResult> {
  const parsed = recommendationSchema.safeParse({ rule, entityKey })

  if (!parsed.success) {
    return { error: INVALID_RECOMMENDATION }
  }

  const workspace = await getPersonalWorkspace()
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

  revalidatePersonalPages()
  return {}
}

// "Mostrar de nuevo": borra la fila del mes actual
export async function restoreRecommendation(
  rule: string,
  entityKey: string
): Promise<RecommendationActionResult> {
  const parsed = recommendationSchema.safeParse({ rule, entityKey })

  if (!parsed.success) {
    return { error: INVALID_RECOMMENDATION }
  }

  const workspace = await getPersonalWorkspace()
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

  revalidatePersonalPages()
  return {}
}
