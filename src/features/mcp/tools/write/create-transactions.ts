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
import {
  accountNameSchema,
  activeAccounts,
  activeCategories,
  categoryNameSchema,
  resolveAccount,
  resolveCategory
} from "./references"
import {
  type TransactionValues,
  categoryErrors,
  previewOf,
  toFormInput,
  transactionFields
} from "./transaction-input"

const newTransaction = z.object({
  ...transactionFields,
  category_id: transactionFields.category_id.optional(),
  category: categoryNameSchema.optional(),
  account_id: transactionFields.account_id
    .optional()
    .describe(
      "Cuenta (de list_accounts), o null fuera de las cuentas. Sin account_id ni account: con una sola cuenta activa se usa esa y con varias se pregunta."
    ),
  account: accountNameSchema.optional(),
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
    "Registra de 1 a 200 ingresos o gastos en un espacio, con las mismas reglas que la app: categoría del mismo tipo, cuenta activa, monto > 0, descripción de 1 a 120 caracteres y nota de hasta 500. Todo o nada: si una fila tiene un error no se guarda ninguna y la respuesta lista los errores por índice. Categoría y cuenta van por id o por nombre (category, account). Usa dry_run para revisar antes. Devuelve un operation_id para revertir con undo_operation. " +
    NEEDS_INPUT_HINT,
  input,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id, {
      writable: true
    })
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    // 1. Cuenta y categoría por id o nombre; lo que falte se pregunta
    const [accounts, categories] = await Promise.all([
      activeAccounts(ctx, workspace.id),
      activeCategories(ctx, workspace)
    ])
    const missing: MissingField[] = []
    const refs = args.transactions.map((row, index) => {
      const account = resolveAccount(accounts, {
        id: row.account_id,
        name: row.account,
        field: "account_id",
        row: index,
        label: "la cuenta",
        nullable: true
      })
      const category = resolveCategory(categories, {
        id: row.category_id,
        name: row.category,
        type: row.type,
        row: index
      })
      if ("missing" in account) missing.push(account.missing)
      if ("missing" in category) missing.push(category.missing)
      return {
        account_id: "value" in account ? account.value : null,
        category_id: "value" in category ? (category.value ?? "") : ""
      }
    })
    if (missing.length > 0) {
      return needsInput(missing)
    }

    // 2. Validar todas las filas con los esquemas de la UI
    const errors: RowError[] = []
    const rows: { values: TransactionValues; data: CreateTransactionData }[] =
      []

    args.transactions.forEach((row, index) => {
      const values: TransactionValues = {
        type: row.type,
        amount: row.amount,
        ...refs[index],
        occurred_on: row.occurred_on,
        description: row.description,
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

    // 3. Categoría y cuenta, contra la BD
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

    // 4. Escribir en orden; si una falla, se deshacen las anteriores
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
