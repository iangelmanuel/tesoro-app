import { z } from "zod"
import { transferSchema } from "@/features/accounts/schemas"
import type { TransferInput } from "@/features/accounts/schemas"
import {
  TRANSFER_NOT_FOUND,
  type TransferRow,
  createTransferRecord,
  deleteTransferRecord,
  updateTransferRecord
} from "@/features/accounts/transfer-service"
import {
  type RowChange,
  commitOperation,
  compensateOperation
} from "../../operations"
import type { McpContext } from "../../types"
import { toolError, toolResult } from "../result"
import {
  type McpWorkspace,
  defineTool,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"
import {
  type RowError,
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
  toTransferInput,
  transferFields,
  transferPreview,
  transferValuesOf
} from "./transfer-input"

// Traspasos entre cuentas del espacio (SPEC 34): crear, editar y borrar en
// lote, todo o nada, con dry_run y log. Las reglas son las de la UI:
// transferSchema y transfer-service.

function plural(count: number, verb: string) {
  return `${count} ${count === 1 ? "traspaso" : "traspasos"} ${verb}${count === 1 ? "" : "s"}`
}

async function writableWorkspace(ctx: McpContext, id: string) {
  return resolveWorkspace(ctx, id, { writable: true })
}

/** Cuentas de origen y destino de las filas válidas */
function accountChecks(
  rows: { index: number; data: TransferInput }[]
): Parameters<typeof accountErrors>[2] {
  return rows.flatMap(({ index, data }) => [
    { index, accountId: data.from_account_id, field: "from_account_id" },
    { index, accountId: data.to_account_id, field: "to_account_id" }
  ])
}

function sortErrors(errors: RowError[]) {
  return errors.sort((a, b) => a.index - b.index)
}

async function loadTransfers(
  ctx: McpContext,
  workspace: McpWorkspace,
  ids: string[]
) {
  const { data, error } = await ctx.supabase
    .from("transfers")
    .select("*")
    .eq("workspace_id", workspace.id)
    .in("id", [...new Set(ids)])
  return error ? null : new Map(data.map((row) => [row.id, row]))
}

// create_transfers

const newTransfer = z.object({
  ...transferFields,
  time: transferFields.time.optional(),
  note: transferFields.note.optional()
})

const createInput = z.object({
  workspace_id: workspaceIdSchema,
  transfers: bulk(newTransfer, "traspaso"),
  dry_run: dryRunSchema
})

export const createTransfers = defineTool({
  name: "create_transfers",
  group: "write",
  title: "Registrar traspasos",
  description:
    "Registra de 1 a 200 traspasos entre dos cuentas activas del espacio (origen distinto de destino, monto > 0). No cuentan como ingreso ni gasto. Todo o nada, con dry_run. Devuelve un operation_id para revertir.",
  input: createInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const workspace = await writableWorkspace(ctx, args.workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    const errors: RowError[] = []
    const rows: {
      index: number
      values: TransferValues
      data: TransferInput
    }[] = []
    args.transfers.forEach((row, index) => {
      const values: TransferValues = {
        ...row,
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
      ...(await accountErrors(ctx, workspace.id, accountChecks(rows)))
    )

    if (errors.length > 0) {
      return batchError(sortErrors(errors))
    }
    if (args.dry_run) {
      return toolResult(
        `Vista previa: ${plural(rows.length, "creado")} en ${workspace.name}. No se guardó nada.`,
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

    const summary = `${plural(rows.length, "creado")} en ${workspace.name}`
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

// update_transfers

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

export const updateTransfers = defineTool({
  name: "update_transfers",
  group: "write",
  title: "Editar traspasos",
  description:
    "Edita de 1 a 200 traspasos: cada elemento lleva el id y solo los campos que cambian (from_account_id, to_account_id, amount, occurred_on, time, note). Mismas reglas que la app. Todo o nada, con dry_run. Devuelve un operation_id para revertir.",
  input: updateInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const workspace = await writableWorkspace(ctx, args.workspace_id)
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
      const after: TransferValues = {
        ...before,
        ...Object.fromEntries(
          Object.entries(patch).filter(([, value]) => value !== undefined)
        )
      }
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
        accountChecks(
          rows.filter(
            (row) =>
              row.after.from_account_id !== row.before.from_account_id ||
              row.after.to_account_id !== row.before.to_account_id
          )
        )
      ))
    )

    if (errors.length > 0) {
      return batchError(sortErrors(errors))
    }
    if (args.dry_run) {
      return toolResult(
        `Vista previa: ${plural(rows.length, "editado")} en ${workspace.name}. No se guardó nada.`,
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

    const summary = `${plural(rows.length, "editado")} en ${workspace.name}`
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

// delete_transfers

const deleteInput = z.object({
  workspace_id: workspaceIdSchema,
  ids: bulk(z.uuid({ error: TRANSFER_NOT_FOUND }), "id").describe(
    "Ids de los traspasos a borrar."
  ),
  dry_run: dryRunSchema
})

export const deleteTransfers = defineTool({
  name: "delete_transfers",
  group: "write",
  title: "Borrar traspasos",
  description:
    "Borra de 1 a 200 traspasos por id. Todo o nada, con dry_run. Se puede deshacer con undo_operation durante 30 días: vuelven con sus mismos ids.",
  input: deleteInput,
  annotations: { readOnlyHint: false, destructiveHint: true },
  async run(ctx, args) {
    const workspace = await writableWorkspace(ctx, args.workspace_id)
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
      return batchError(sortErrors(errors))
    }
    if (args.dry_run) {
      return toolResult(
        `Vista previa: ${plural(rows.length, "borrado")} en ${workspace.name}. No se borró nada.`,
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

    const summary = `${plural(rows.length, "borrado")} en ${workspace.name}`
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
