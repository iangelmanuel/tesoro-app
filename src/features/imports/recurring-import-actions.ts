"use server"

import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/features/workspaces/revalidate"
import { createClient } from "@/libs/supabase/server"
import { DEFAULT_ERROR } from "./import-errors"
import { importRecurringRecord } from "./import-service"
import {
  type ConfirmRecurringImportInput,
  confirmRecurringImportSchema
} from "./schemas"
import type { ConfirmImportResult } from "./types"

/** Gastos fijos: guarda las filas marcadas todo o nada */
export async function confirmRecurringImport(
  input: ConfirmRecurringImportInput
): Promise<ConfirmImportResult> {
  const parsed = confirmRecurringImportSchema.safeParse(input)

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? DEFAULT_ERROR }
  }

  const supabase = await createClient()
  const result = await importRecurringRecord(
    supabase,
    getPersonalWorkspace,
    parsed.data
  )

  if (result.error === undefined) revalidatePersonalPages()
  return result
}
