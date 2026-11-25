import { z } from "zod"
import { type TransferInput, transferSchema } from "@/features/accounts/schemas"
import {
  TRANSFER_NOT_FOUND,
  updateTransferRecord
} from "@/features/accounts/transfer-service"
import {
  type RowChange,
  commitOperation,
  compensateOperation
} from "../../operations"
import { toolError, toolResult } from "../result"
import { defineTool, resolveWorkspace, workspaceIdSchema } from "../shared"
import {
  accountErrors,
  batchError,
  bulk,
  dryRunSchema,
  duplicateIdErrors,
  midwayError,
  writeResult,
  zodRowErrors
} from "./batch"
import {
  type TransferValues,
  applyTransferPatch,
  sortRowErrors,
  toTransferInput,
  transferAccountChecks,
  transferFields,
  transferPreview,
  transferValuesOf,
  transfersLabel
} from "./transfer-input"
import { loadTransfers } from "./transfer-queries"

// update_transfers (SPEC 34): editar traspasos en lote, todo o nada, con
// dry_run y log

const transferPatch = z
  .object({
    id: z.uuid({ error: TRANSFER_NOT_FOUND }).describe("Id del traspaso."),
    from_account_id: transferFields.from_account_id.optional(),
    to_account_id: transferFields.to_account_id.optional(),
    amount: transferFields.amount.optional(),
    occurred_on: transferFields.occurred_on.optional(),
    time: transferFields.time.optional(),
    note: transferFields.note.optional()
  })
  .describe("El id y solo los campos que cambian.")

const updateInput = z.object({
  workspace_id: workspaceIdSchema,
  transfers: bulk(transferPatch, "cambio"),
  dry_run: dryRunSchema
})

/** Edita traspasos en lote */
export const updateTransfers = defineTool({
  name: "update_transfers",
  group: "write",
  title: "Editar traspasos",
  description:
    "Edita de 1 a 200 traspasos: cada elemento lleva el id y solo los campos que cambian (from_account_id, to_account_id, amount, occurred_on, time, note). Mismas reglas que la app. Todo o nada, con dry_run. Devuelve un operation_id para revertir.",
  input: updateInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id, {
      writable: true
    })
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    const ids = args.transfers.map((patch) => patch.id)
    const errors = duplicateIdErrors(ids)
    const current = await loadTransfers(ctx, workspace, ids)
    if (!current) {
      return toolError("No se pudieron cargar los traspasos.")
    }

    const rows: {
      index: number
      id: string
      before: TransferValues
      after: TransferValues
      data: TransferInput
    }[] = []
    for (const [index, { id, ...patch }] of args.transfers.entries()) {
      const row = current.get(id)
      if (!row) {
        errors.push({ index, field: "id", message: TRANSFER_NOT_FOUND })
        continue
      }
      const before = transferValuesOf(row)
      const after = applyTransferPatch(before, patch)
      const parsed = transferSchema.safeParse(toTransferInput(after))
      if (parsed.success) {
        rows.push({ index, id, before, after, data: parsed.data })
      } else {
        errors.push(...zodRowErrors(index, parsed.error))
      }
    }
    errors.push(
      ...(await accountErrors(
        ctx,
        workspace.id,
        transferAccountChecks(
          rows.filter(
            (row) =>
              row.after.from_account_id !== row.before.from_account_id ||
              row.after.to_account_id !== row.before.to_account_id
          )
        )
      ))
    )

    if (errors.length > 0) {
      return batchError(sortRowErrors(errors))
    }
    if (args.dry_run) {
      return toolResult(
        `Vista previa: ${transfersLabel(rows.length, "editado")} en ${workspace.name}. No se guardó nada.`,
        {
          dry_run: true,
          rows: rows.map((row) => ({
            index: row.index,
            before: transferPreview(row.before),
            after: transferPreview(row.after)
          })),
          currency: ctx.currency
        }
      )
    }

    const summary = `${transfersLabel(rows.length, "editado")} en ${workspace.name}`
    const changes: RowChange[] = []
    const operation = {
      workspaceId: workspace.id,
      tool: "update_transfers",
      summary,
      changes
    }

    for (const row of rows) {
      const result = await updateTransferRecord(
        ctx.supabase,
        workspace,
        row.id,
        row.data
      )
      if (!result.ok) {
        return midwayError(
          row.index,
          result,
          await compensateOperation(ctx, operation)
        )
      }
      changes.push({
        table: "transfers",
        rowId: row.id,
        before: result.before,
        after: result.after
      })
    }

    const operationId = await commitOperation(ctx, operation)
    return writeResult(ctx, {
      operationId,
      summary,
      ids: rows.map((row) => row.id)
    })
  }
})
