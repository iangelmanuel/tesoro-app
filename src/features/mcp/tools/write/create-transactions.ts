import { z } from "zod"
import { createTransactionSchema } from "@/features/transactions/schemas"
import {
  type CreateTransactionData,
  createTransactionRecord
} from "@/features/transactions/service"
import {
  type RowChange,
  commitOperation,
  compensateOperation
} from "../../operations"
import { toolError, toolResult } from "../result"
import { defineTool, resolveWorkspace, workspaceIdSchema } from "../shared"
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
import {
  type TransactionValues,
  categoryErrors,
  previewOf,
  toFormInput,
  transactionFields
} from "./transaction-input"

const newTransaction = z.object({
  ...transactionFields,
  account_id: transactionFields.account_id.optional(),
  time: transactionFields.time.optional(),
  note: transactionFields.note.optional()
})

const input = z.object({
  workspace_id: workspaceIdSchema,
  transactions: bulk(newTransaction, "movimiento"),
  dry_run: dryRunSchema
})

function plural(count: number) {
  return count === 1 ? "movimiento creado" : "movimientos creados"
}

export const createTransactions = defineTool({
  name: "create_transactions",
  group: "write",
  title: "Registrar movimientos",
  description:
    "Registra de 1 a 200 ingresos o gastos en un espacio, con las mismas reglas que la app: categoría del mismo tipo, cuenta activa, monto > 0, descripción de 1 a 120 caracteres y nota de hasta 500. Todo o nada: si una fila tiene un error no se guarda ninguna y la respuesta lista los errores por índice. Usa dry_run para revisar antes. Devuelve un operation_id para revertir con undo_operation.",
  input,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id, {
      writable: true
    })
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    // 1. Validar todas las filas con los esquemas de la UI
    const errors: RowError[] = []
    const rows: { values: TransactionValues; data: CreateTransactionData }[] =
      []

    args.transactions.forEach((row, index) => {
      const values: TransactionValues = {
        ...row,
        account_id: row.account_id ?? null,
        time: row.time ?? null,
        note: row.note ?? null,
        counterparty: null,
        invoice_ref: null
      }
      const parsed = createTransactionSchema.safeParse({
        ...toFormInput(values),
        recurring_expense_id: "",
        recurring_due_on: "",
        transfer_from: "",
        transfer_amount: ""
      })
      if (parsed.success) {
        rows[index] = { values, data: parsed.data }
      } else {
        errors.push(...zodRowErrors(index, parsed.error))
      }
    })

    // 2. Categoría y cuenta, contra la BD
    const valid = rows.flatMap((row, index) => (row ? [{ ...row, index }] : []))
    errors.push(
      ...(await categoryErrors(
        ctx,
        workspace.type,
        valid.map((row) => ({
          index: row.index,
          categoryId: row.data.category_id,
          type: row.data.type
        }))
      )),
      ...(await accountErrors(
        ctx,
        workspace.id,
        valid.map((row) => ({
          index: row.index,
          accountId: row.data.account_id,
          field: "account_id"
        }))
      ))
    )

    if (errors.length > 0) {
      return batchError(errors.sort((a, b) => a.index - b.index))
    }

    if (args.dry_run) {
      return toolResult(
        `Vista previa: ${rows.length} ${plural(rows.length)} en ${workspace.name}. No se guardó nada.`,
        {
          dry_run: true,
          rows: rows.map((row, index) => ({
            index,
            before: null,
            after: previewOf(row.values)
          })),
          currency: ctx.currency
        }
      )
    }

    // 3. Escribir en orden; si una falla, se deshacen las anteriores
    const summary = `${rows.length} ${plural(rows.length)} en ${workspace.name}`
    const changes: RowChange[] = []

    for (const [index, row] of rows.entries()) {
      const result = await createTransactionRecord(
        ctx.supabase,
        workspace,
        row.data
      )
      if (!result.ok) {
        const compensation = await compensateOperation(ctx, {
          workspaceId: workspace.id,
          tool: "create_transactions",
          summary,
          changes
        })
        return midwayError(index, result, compensation)
      }
      changes.push({
        table: "transactions",
        rowId: result.after.id,
        before: null,
        after: result.after
      })
    }

    const operationId = await commitOperation(ctx, {
      workspaceId: workspace.id,
      tool: "create_transactions",
      summary,
      changes
    })
    return writeResult(ctx, {
      operationId,
      summary,
      ids: changes.map((change) => change.rowId)
    })
  }
})
