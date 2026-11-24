"use server"

import { z } from "zod"
import { requireWritableWorkspace } from "@/features/workspaces/queries"
import { revalidateWorkspacePages } from "@/features/workspaces/revalidate"
import { createClient } from "@/libs/supabase/server"
import { LEDGER_KINDS, moveLedgerEntryRecord } from "./ledger-service"
import { NOT_FOUND } from "./transaction-errors"
import type { TransactionActionResult, VerifyEntry } from "./types"
import { getVerifyEntries } from "./verify-queries"

// Acciones sobre la lista unificada de Movimientos: reordenar (SPEC 19) y
// Verificar movimientos

const moveSchema = z.object({
  kind: z.enum(LEDGER_KINDS),
  id: z.uuid(),
  targetKind: z.enum(LEDGER_KINDS),
  targetId: z.uuid()
})

const verifySchema = z.object({
  workspaceId: z.uuid(),
  accountId: z.uuid().nullable(),
  offset: z.number().int().min(0).max(100_000)
})

const VERIFY_ERROR = "No se pudieron cargar los movimientos"

// Mueve una fila a la posición de otra del mismo día
export async function moveLedgerEntry(
  workspaceId: string,
  kind: string,
  id: string,
  targetKind: string,
  targetId: string
): Promise<TransactionActionResult> {
  const parsed = moveSchema.safeParse({ kind, id, targetKind, targetId })

  if (!parsed.success) {
    return { error: NOT_FOUND }
  }

  const workspace = await requireWritableWorkspace(workspaceId)
  const supabase = await createClient()
  const result = await moveLedgerEntryRecord(
    supabase,
    workspace,
    { kind: parsed.data.kind, id: parsed.data.id },
    { kind: parsed.data.targetKind, id: parsed.data.targetId }
  )

  if (!result.ok) {
    return { error: result.error }
  }

  revalidateWorkspacePages(workspace)
  return {}
}

// Página de Verificar movimientos. Solo lectura: RLS limita las filas al dueño
// del espacio, así que no hace falta resolver el espacio con permiso de
// escritura.
export async function loadVerifyEntries(
  workspaceId: string,
  accountId: string | null,
  offset: number
): Promise<{ rows: VerifyEntry[]; hasMore: boolean } | { error: string }> {
  const parsed = verifySchema.safeParse({ workspaceId, accountId, offset })

  if (!parsed.success) {
    return { error: VERIFY_ERROR }
  }

  try {
    return await getVerifyEntries(parsed.data.workspaceId, {
      accountId: parsed.data.accountId ?? undefined,
      offset: parsed.data.offset
    })
  } catch {
    return { error: VERIFY_ERROR }
  }
}
