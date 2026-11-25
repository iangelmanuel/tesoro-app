"use server"

import { z } from "zod"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/features/workspaces/revalidate"
import { createClient } from "@/libs/supabase/server"
import { getDuplicateCandidatesFor } from "./duplicate-queries"
import type { DuplicateCandidatesResult, DuplicateRequest } from "./duplicates"
import { UNDO_NOT_FOUND } from "./import-errors"
import { undoImportRecord } from "./import-service"
import type { UndoImportResult } from "./types"

// Actions comunes a todos los destinos. Confirmar una importación tiene una
// action por destino (`*-import-actions.ts`).

const idSchema = z.uuid()

/** Filas existentes del destino para marcar duplicados en la vista previa */
export async function getDuplicateCandidates(
  request: DuplicateRequest
): Promise<DuplicateCandidatesResult> {
  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  return getDuplicateCandidatesFor(supabase, workspace.id, request)
}

/** Deshace una importación del historial */
export async function undoImport(importId: string): Promise<UndoImportResult> {
  const parsedId = idSchema.safeParse(importId)

  if (!parsedId.success) {
    return { error: UNDO_NOT_FOUND }
  }

  // Valida la sesión antes de llamar la RPC (redirige si no hay)
  await getPersonalWorkspace()
  const supabase = await createClient()
  const result = await undoImportRecord(supabase, parsedId.data)

  if (result.error === undefined) revalidatePersonalPages()
  return result
}
