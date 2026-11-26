"use server"

import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/features/workspaces/revalidate"
import { createClient } from "@/libs/supabase/server"
import { DEFAULT_ERROR } from "./import-errors"
import { importDebtEntriesRecord } from "./import-service"
import {
  type ConfirmDebtEntriesImportInput,
  confirmDebtEntriesImportSchema
} from "./schemas"
import type { ConfirmImportResult } from "./types"

/** Deudas: guarda los pagos y ajustes marcados todo o nada */
export async function confirmDebtEntriesImport(
  input: ConfirmDebtEntriesImportInput
): Promise<ConfirmImportResult> {
  const parsed = confirmDebtEntriesImportSchema.safeParse(input)

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? DEFAULT_ERROR }
  }

  const supabase = await createClient()
  const result = await importDebtEntriesRecord(
    supabase,
    getPersonalWorkspace,
    parsed.data
  )

  if (result.error === undefined) revalidatePersonalPages()
  return result
}
