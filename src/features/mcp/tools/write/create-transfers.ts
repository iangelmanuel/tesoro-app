import { z } from "zod"
import { type TransferInput, transferSchema } from "@/features/accounts/schemas"
import { createTransferRecord } from "@/features/accounts/transfer-service"
import {
  type RowChange,
  commitOperation,
  compensateOperation
} from "../../operations"
import { toolError, toolResult } from "../result"
import {
  type MissingField,
  NEEDS_INPUT_HINT,
  defineTool,
  needsInput,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"
import {
  type RowError,
  accountErrors,
  batchError,
  bulk,
  dryRunSchema,
  midwayError,
  writeResult,
  zodRowErrors
} from "./batch"
import { accountNameSchema, activeAccounts, resolveAccount } from "./references"
import {
  type TransferValues,
  sortRowErrors,
  toTransferInput,
  transferAccountChecks,
  transferFields,
  transferPreview,
  transfersLabel
} from "./transfer-input"

// create_transfers (SPEC 34): traspasos entre cuentas del espacio en lote,
// todo o nada, con dry_run y log. Las reglas son las de la UI:
// transferSchema y transfer-service.

const newTransfer = z.object({
  ...transferFields,
  from_account_id: transferFields.from_account_id.optional(),
  from_account: accountNameSchema
    .optional()
    .describe("Nombre de la cuenta de origen, si no tienes el id."),
  to_account_id: transferFields.to_account_id.optional(),
  to_account: accountNameSchema
    .optional()
    .describe("Nombre de la cuenta de destino, si no tienes el id."),
  time: transferFields.time.optional(),
  note: transferFields.note.optional()
})

const createInput = z.object({
  workspace_id: workspaceIdSchema,
  transfers: bulk(newTransfer, "traspaso"),
  dry_run: dryRunSchema
})

/** Registra traspasos en lote */
export const createTransfers = defineTool({
  name: "create_transfers",
  group: "write",
  title: "Registrar traspasos",
  description:
    "Registra de 1 a 200 traspasos entre dos cuentas activas del espacio (origen distinto de destino, monto > 0). No cuentan como ingreso ni gasto. Las cuentas van por id o por nombre (from_account, to_account). Todo o nada, con dry_run. Devuelve un operation_id para revertir. " +
    NEEDS_INPUT_HINT,
  input: createInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id, {
      writable: true
    })
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    // Cuentas por id o nombre; lo que falte se pregunta
    const accounts = await activeAccounts(ctx, workspace.id)
    const missing: MissingField[] = []
    const refs = args.transfers.map((row, index) => {
      const sides = [
        ["from", row.from_account_id, row.from_account, "la cuenta de origen"],
        ["to", row.to_account_id, row.to_account, "la cuenta de destino"]
      ] as const
      const [from, to] = sides.map(([side, id, name, label]) => {
        const resolved = resolveAccount(accounts, {
          id,
          name,
          field: `${side}_account_id`,
          row: index,
          label,
          nullable: false
        })
        if ("missing" in resolved) {
          missing.push(resolved.missing)
          return ""
        }
        return resolved.value ?? ""
      })
      return { from_account_id: from, to_account_id: to }
    })
    if (missing.length > 0) {
      return needsInput(missing)
    }

    const errors: RowError[] = []
    const rows: {
      index: number
      values: TransferValues
      data: TransferInput
    }[] = []
    args.transfers.forEach((row, index) => {
      const values: TransferValues = {
        ...refs[index],
        amount: row.amount,
        occurred_on: row.occurred_on,
        time: row.time ?? null,
        note: row.note ?? null
      }
      const parsed = transferSchema.safeParse(toTransferInput(values))
      if (parsed.success) {
        rows.push({ index, values, data: parsed.data })
      } else {
        errors.push(...zodRowErrors(index, parsed.error))
      }
    })
    errors.push(
      ...(await accountErrors(ctx, workspace.id, transferAccountChecks(rows)))
    )

    if (errors.length > 0) {
      return batchError(sortRowErrors(errors))
    }
    if (args.dry_run) {
      return toolResult(
        `Vista previa: ${transfersLabel(rows.length, "creado")} en ${workspace.name}. No se guardó nada.`,
        {
          dry_run: true,
          rows: rows.map((row) => ({
            index: row.index,
            before: null,
            after: transferPreview(row.values)
          })),
          currency: ctx.currency
        }
      )
    }

    const summary = `${transfersLabel(rows.length, "creado")} en ${workspace.name}`
    const changes: RowChange[] = []
    const operation = {
      workspaceId: workspace.id,
      tool: "create_transfers",
      summary,
      changes
    }

    for (const row of rows) {
      const result = await createTransferRecord(
        ctx.supabase,
        workspace,
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
        rowId: result.after.id,
        before: null,
        after: result.after
      })
    }

    const operationId = await commitOperation(ctx, operation)
    return writeResult(ctx, {
      operationId,
      summary,
      ids: changes.map((change) => change.rowId)
    })
  }
})
