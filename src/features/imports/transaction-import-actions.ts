"use server"

import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/features/workspaces/revalidate"
import { createClient } from "@/libs/supabase/server"
import { DEFAULT_ERROR } from "./import-errors"
import { importTransactionsRecord } from "./import-service"
import { type ConfirmImportInput, confirmImportSchema } from "./schemas"
import type { ConfirmImportResult } from "./types"

/** Movimientos: guarda las filas marcadas todo o nada */
export async function confirmImport(
  input: ConfirmImportInput
): Promise<ConfirmImportResult> {
  const parsed = confirmImportSchema.safeParse(input)

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? DEFAULT_ERROR }
  }

  const supabase = await createClient()
  const result = await importTransactionsRecord(
    supabase,
    getPersonalWorkspace,
    parsed.data
  )

  if (result.error === undefined) revalidatePersonalPages()
  return result
}
