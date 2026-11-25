"use server"

import { z } from "zod"
import { BUSINESS_RULE_KEYS } from "@/features/business-score/constants"
import { requireWritableWorkspace } from "@/features/workspaces/queries"
import { revalidateWorkspacePages } from "@/features/workspaces/revalidate"
import type { WorkspaceType } from "@/features/workspaces/types"
import { createClient } from "@/libs/supabase/server"
import { ENTITY_KEY_MAX, RULE_KEYS } from "./constants"
import {
  dismissRecommendationRecord,
  restoreRecommendationRecord
} from "./dismissed-service"

export interface RecommendationActionResult {
  error?: string
}

const INVALID_RECOMMENDATION = "La recomendación no es válida"

const entityKeySchema = z.string().trim().min(1).max(ENTITY_KEY_MAX)

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

/**
 * Valida la regla y la entidad para el tipo del espacio. Cada espacio solo
 * acepta sus reglas: una de Personal sobre una empresa (o al revés) es un
 * error de validación.
 */
function parseKey(type: WorkspaceType, rule: string, entityKey: string) {
  const parsed = RECOMMENDATION_SCHEMAS[type].safeParse({ rule, entityKey })
  return parsed.success ? parsed.data : null
}

type DismissedWrite = typeof dismissRecommendationRecord

/** Valida la clave, escribe con `write` y revalida las páginas del espacio */
async function writeDismissed(
  workspaceId: string,
  rule: string,
  entityKey: string,
  write: DismissedWrite
): Promise<RecommendationActionResult> {
  const workspace = await requireWritableWorkspace(workspaceId)
  const key = parseKey(workspace.type, rule, entityKey)
  if (!key) return { error: INVALID_RECOMMENDATION }

  const result = await write(await createClient(), workspace, key)
  if (!result.ok) return { error: result.error }

  revalidateWorkspacePages(workspace)
  return {}
}

/** "Ocultar este mes": una fila por espacio, regla, entidad y mes actual */
export async function dismissRecommendation(
  workspaceId: string,
  rule: string,
  entityKey: string
): Promise<RecommendationActionResult> {
  return writeDismissed(
    workspaceId,
    rule,
    entityKey,
    dismissRecommendationRecord
  )
}

/** "Mostrar de nuevo": borra la fila del mes actual */
export async function restoreRecommendation(
  workspaceId: string,
  rule: string,
  entityKey: string
): Promise<RecommendationActionResult> {
  return writeDismissed(
    workspaceId,
    rule,
    entityKey,
    restoreRecommendationRecord
  )
}
