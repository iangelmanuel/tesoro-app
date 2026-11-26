import { z } from "zod"
import { type LoadedDebt, loadDebt } from "@/features/debts/debt-loader"
import { type Debt, getDebts } from "@/features/debts/queries"
import type { ServiceFailure } from "@/features/workspaces/service-result"
import { type OperationInput, commitOperation } from "../../operations"
import type { McpContext } from "../../types"
import { toolError } from "../result"
import { type McpWorkspace, PERSONAL_ONLY, resolveWorkspace } from "../shared"
import { failureRowErrors, writeResult } from "./batch"

// Piezas comunes de las tools de movimientos de deuda (SPEC 43):
// record_debt_payment, collect_receivable, update_debt_entry y
// delete_debt_entry. Usan los servicios de las actions
// (debts/entry-service.ts) y dejan en el log la deuda, el abono, sus
// movimientos y sus asignaciones para revertir.

/** La deuda no existe o no es del espacio */
export const DEBT_NOT_FOUND = "No se encontró la deuda en este espacio."
/** El movimiento de deuda no existe o no es del espacio */
export const ENTRY_NOT_FOUND = "No se encontró el movimiento de la deuda."

/** Id de la deuda de entrada */
export const debtIdSchema = z
  .uuid({ error: DEBT_NOT_FOUND })
  .describe("Id de la deuda (de list_debts o list_receivables).")

/** Cuenta del pago o del cobro: id, o null = fuera de las cuentas */
export const accountIdField = z
  .uuid({ error: "Elige una cuenta válida" })
  .nullable()
  .optional()

/** Espacio Personal con escritura */
export async function personalWorkspace(ctx: McpContext, id: string) {
  const workspace = await resolveWorkspace(ctx, id, { writable: true })
  if ("error" in workspace) {
    return workspace
  }
  if (workspace.type !== "personal") {
    return { error: PERSONAL_ONLY }
  }
  return workspace
}

/** La deuda con su saldo (servicio) y su resumen (descripciones, cuenta) */
export async function findDebt(
  ctx: McpContext,
  workspace: McpWorkspace,
  debtId: string
): Promise<{ loaded: LoadedDebt; overview: Debt } | null> {
  const [loaded, debts] = await Promise.all([
    loadDebt(ctx.supabase, workspace.id, debtId),
    getDebts(workspace.id)
  ])
  const overview = debts.find((debt) => debt.id === debtId)
  return loaded && overview ? { loaded, overview } : null
}

/** Error de un servicio, con sus campos */
export function serviceError(
  failure: Pick<ServiceFailure, "error" | "fieldErrors">
) {
  const errors = failureRowErrors(0, failure).map(({ field, message }) => ({
    ...(field ? { field } : {}),
    message
  }))
  return toolError(
    failure.error ?? errors[0]?.message ?? "No se pudo guardar.",
    { errors }
  )
}

/** El esquema de la UI rechazó los datos */
export function zodError(error: z.ZodError) {
  return serviceError({ fieldErrors: z.flattenError(error).fieldErrors })
}

/** Deja la operación en el log y responde con su operation_id */
export async function commit(
  ctx: McpContext,
  operation: OperationInput,
  ids: string[]
) {
  const operationId = await commitOperation(ctx, operation)
  return writeResult(ctx, { operationId, summary: operation.summary, ids })
}
