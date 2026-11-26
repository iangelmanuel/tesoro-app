import { z } from "zod"
import {
  TRANSFER_NOT_FOUND,
  type TransferRow,
  deleteTransferRecord
} from "@/features/accounts/transfer-service"
import {
  type RowChange,
  commitOperation,
  compensateOperation
} from "../../operations"
import { toolError, toolResult } from "../result"
import { defineTool, resolveWorkspace, workspaceIdSchema } from "../shared"
import {
  batchError,
  bulk,
  dryRunSchema,
  duplicateIdErrors,
  midwayError,
  writeResult
} from "./batch"
import {
  sortRowErrors,
  transferPreview,
  transferValuesOf,
  transfersLabel
} from "./transfer-input"
import { loadTransfers } from "./transfer-queries"

// delete_transfers (SPEC 34): borrar traspasos en lote, todo o nada, con
// dry_run y log

const deleteInput = z.object({
  workspace_id: workspaceIdSchema,
  ids: bulk(z.uuid({ error: TRANSFER_NOT_FOUND }), "id").describe(
    "Ids de los traspasos a borrar."
  ),
  dry_run: dryRunSchema
})

/** Borra traspasos en lote */
export const deleteTransfers = defineTool({
  name: "delete_transfers",
  group: "write",
  title: "Borrar traspasos",
  description:
    "Borra de 1 a 200 traspasos por id. Todo o nada, con dry_run. Se puede deshacer con undo_operation durante 30 días: vuelven con sus mismos ids.",
  input: deleteInput,
  annotations: { readOnlyHint: false, destructiveHint: true },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id, {
      writable: true
    })
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    const errors = duplicateIdErrors(args.ids)
    const current = await loadTransfers(ctx, workspace, args.ids)
    if (!current) {
      return toolError("No se pudieron cargar los traspasos.")
    }

    const rows: { index: number; row: TransferRow }[] = []
    for (const [index, id] of args.ids.entries()) {
      const row = current.get(id)
      if (row) {
        rows.push({ index, row })
      } else {
        errors.push({ index, message: TRANSFER_NOT_FOUND })
      }
    }

    if (errors.length > 0) {
      return batchError(sortRowErrors(errors))
    }
    if (args.dry_run) {
      return toolResult(
        `Vista previa: ${transfersLabel(rows.length, "borrado")} en ${workspace.name}. No se borró nada.`,
        {
          dry_run: true,
          rows: rows.map(({ index, row }) => ({
            index,
            before: { id: row.id, ...transferPreview(transferValuesOf(row)) },
            after: null
          })),
          currency: ctx.currency
        }
      )
    }

    const summary = `${transfersLabel(rows.length, "borrado")} en ${workspace.name}`
    const changes: RowChange[] = []
    const operation = {
      workspaceId: workspace.id,
      tool: "delete_transfers",
      summary,
      changes
    }

    for (const { index, row } of rows) {
      const result = await deleteTransferRecord(ctx.supabase, workspace, row.id)
      if (!result.ok) {
        return midwayError(
          index,
          result,
          await compensateOperation(ctx, operation)
        )
      }
      changes.push({
        table: "transfers",
        rowId: row.id,
        before: result.before,
        after: null
      })
    }

    const operationId = await commitOperation(ctx, operation)
    return writeResult(ctx, {
      operationId,
      summary,
      ids: rows.map(({ row }) => row.id)
    })
  }
})
