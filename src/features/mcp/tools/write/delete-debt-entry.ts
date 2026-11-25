import { z } from "zod"
import { loadEntry } from "@/features/debts/debt-loader"
import { deleteEntryRecord } from "@/features/debts/entry-service"
import { toolError } from "../result"
import { defineTool, workspaceIdSchema } from "../shared"
import {
  ENTRY_NOT_FOUND,
  commit,
  personalWorkspace,
  serviceError
} from "./debt-entry-shared"
import { debtChanges, snapshotDebtEntry } from "./debt-snapshots"

// delete_debt_entry (SPEC 43): borrar un movimiento de una deuda

const deleteInput = z.object({
  workspace_id: workspaceIdSchema,
  entry_id: z
    .uuid({ error: ENTRY_NOT_FOUND })
    .describe("Id del movimiento de la deuda.")
})

/** Borra un movimiento de deuda y su movimiento enlazado */
export const deleteDebtEntry = defineTool({
  name: "delete_debt_entry",
  group: "write",
  title: "Borrar un movimiento de deuda",
  description:
    "Borra un pago, cobro, compra, avance, cuota de manejo o ajuste de una deuda, como la app: si tiene movimiento enlazado también se borra, y no puede dejar el saldo negativo. Solo Personal. Se puede deshacer con undo_operation durante 30 días.",
  input: deleteInput,
  annotations: { readOnlyHint: false, destructiveHint: true },
  async run(ctx, args) {
    const workspace = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }
    const entry = await loadEntry(ctx.supabase, workspace.id, args.entry_id)
    if (!entry) {
      return toolError(ENTRY_NOT_FOUND)
    }

    const before = await snapshotDebtEntry(ctx, {
      debtId: entry.debt_id,
      entryId: entry.id
    })
    const result = await deleteEntryRecord(ctx.supabase, entry)
    if (!result.ok) {
      return serviceError(result)
    }
    const after = await snapshotDebtEntry(ctx, {
      debtId: entry.debt_id,
      entryId: entry.id,
      transactionIds: [...before.transactions.keys()]
    })

    return commit(
      ctx,
      {
        workspaceId: workspace.id,
        tool: "delete_debt_entry",
        summary: `Movimiento de ${entry.debt.name} borrado`,
        changes: debtChanges(before, after)
      },
      [entry.id]
    )
  }
})
