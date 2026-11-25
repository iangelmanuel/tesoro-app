"use server"

import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/features/workspaces/revalidate"
import { createClient } from "@/libs/supabase/server"
import { DEFAULT_ERROR } from "./import-errors"
import { importGoalContributionsRecord } from "./import-service"
import {
  type ConfirmGoalContributionsImportInput,
  confirmGoalContributionsImportSchema
} from "./schemas"
import type { ConfirmImportResult } from "./types"

/** Metas: guarda los aportes y retiros marcados todo o nada */
export async function confirmGoalContributionsImport(
  input: ConfirmGoalContributionsImportInput
): Promise<ConfirmImportResult> {
  const parsed = confirmGoalContributionsImportSchema.safeParse(input)

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? DEFAULT_ERROR }
  }

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const result = await importGoalContributionsRecord(
    supabase,
    workspace,
    parsed.data
  )

  if (result.error === undefined) revalidatePersonalPages()
  return result
}
