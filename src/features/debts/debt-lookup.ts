import "server-only"
import { z } from "zod"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { createClient } from "@/libs/supabase/server"
import { loadDebt, loadEntry } from "./debt-loader"

// Lo que comparten las actions de deudas: el id y la deuda o el movimiento
// del espacio Personal del usuario

/** Id de una deuda o un movimiento */
export const idSchema = z.uuid()

/** Deuda del espacio Personal del usuario, con su saldo actual */
export async function findDebt(debtId: string) {
  const workspace = await getPersonalWorkspace()
  return loadDebt(await createClient(), workspace.id, debtId)
}

/** Movimiento del espacio Personal del usuario, con su deuda */
export async function findEntry(entryId: string) {
  const workspace = await getPersonalWorkspace()
  return loadEntry(await createClient(), workspace.id, entryId)
}
