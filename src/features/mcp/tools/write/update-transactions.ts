import { z } from "zod"
import {
  type LoadedEntry,
  entryRecord,
  loadEntry,
  updatePaymentEntry,
  validatePaymentChange
} from "@/features/debts/entry-service"
import { transactionSchema } from "@/features/transactions/schemas"
import {
  NOT_FOUND,
  type TransactionRow,
  type UpdateTransactionData,
  updateTransactionRecord
} from "@/features/transactions/service"
import {
  type RowChange,
  commitOperation,
  compensateOperation
} from "../../operations"
import { toolError, toolResult } from "../result"
import {
  defineTool,
  formatTime,
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
  type TransactionValues,
  categoryErrors,
  previewOf,
  toFormInput,
  transactionFields
} from "./transaction-input"

const LINKED_ONLY_FIELDS =
  "Este movimiento es un pago o avance de deuda: solo se pueden cambiar monto, fecha, hora y nota."

const patchSchema = z
  .object({
    id: z.uuid({ error: NOT_FOUND }).describe("Id del movimiento."),
    type: transactionFields.type.optional(),
    amount: transactionFields.amount.optional(),
    category_id: transactionFields.category_id.optional(),
    account_id: transactionFields.account_id.optional(),
    occurred_on: transactionFields.occurred_on.optional(),
    time: transactionFields.time.optional(),
    description: transactionFields.description.optional(),
    note: transactionFields.note.optional()
  })
  .describe("El id y solo los campos que cambian.")

type Patch = z.output<typeof patchSchema>

const input = z.object({
  workspace_id: workspaceIdSchema,
  transactions: bulk(patchSchema, "cambio"),
  dry_run: dryRunSchema
})

type CurrentRow = TransactionRow & { debt_entries: { id: string } | null }

function valuesOf(row: TransactionRow): TransactionValues {
  return {
    type: row.type,
    amount: Number(row.amount),
    category_id: row.category_id,
    account_id: row.account_id,
    occurred_on: row.occurred_on,
    time: formatTime(row.occurred_time),
    description: row.description,
    note: row.note,
    counterparty: row.counterparty,
    invoice_ref: row.invoice_ref
  }
}

function merge(current: TransactionValues, patch: Patch): TransactionValues {
  return {
    ...current,
    ...Object.fromEntries(
      Object.entries(patch).filter(
        ([key, value]) => key !== "id" && value !== undefined
      )
    )
  }
}

type Plan =
  | { kind: "plain"; id: string; data: UpdateTransactionData }
  | {
      kind: "linked"
      id: string
      entry: LoadedEntry
      amount: number
      occurred_on: string
      occurred_time: string | null
      note: string | null
      noteChanged: boolean
      entryChanged: boolean
    }

export const updateTransactions = defineTool({
  name: "update_transactions",
  group: "write",
  title: "Editar movimientos",
  description:
    "Edita de 1 a 200 movimientos: cada elemento lleva el id y solo los campos que cambian (type, amount, category_id, account_id, occurred_on, time, description, note). Mismas reglas que la app. En un pago de deuda, avance de tarjeta o cobro de Me deben (link.kind debt o receivable) solo cambian monto, fecha, hora y nota, y el abono se actualiza con él. Todo o nada, con dry_run. Devuelve un operation_id para revertir.",
  input,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id, {
      writable: true
    })
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    const ids = args.transactions.map((patch) => patch.id)
    const errors: RowError[] = duplicateIdErrors(ids)

    const { data: found, error: loadError } = await ctx.supabase
      .from("transactions")
      .select("*, debt_entries(id)")
      .eq("workspace_id", workspace.id)
      .in("id", [...new Set(ids)])
    if (loadError) {
      return toolError("No se pudieron cargar los movimientos.")
    }
    const currentById = new Map(
      (found as CurrentRow[]).map((row) => [row.id, row])
    )

    // 1. Validar cada cambio sobre la fila actual
    const plans: Plan[] = []
    const previews: { index: number; before: object; after: object }[] = []
    const categoryChecks: Parameters<typeof categoryErrors>[2] = []
    const accountChecks: Parameters<typeof accountErrors>[2] = []

    for (const [index, patch] of args.transactions.entries()) {
      const current = currentById.get(patch.id)
      if (!current) {
        errors.push({ index, field: "id", message: NOT_FOUND })
        continue
      }

      const before = valuesOf(current)
      const after = merge(before, patch)
      const parsed = transactionSchema.safeParse(toFormInput(after))
      if (!parsed.success) {
        errors.push(...zodRowErrors(index, parsed.error))
        continue
      }
      previews.push({
        index,
        before: previewOf(before),
        after: previewOf(after)
      })

      if (current.debt_entries) {
        const blocked =
          after.type !== before.type ||
          after.category_id !== before.category_id ||
          after.account_id !== before.account_id ||
          after.description.trim() !== before.description
        if (blocked) {
          errors.push({ index, message: LINKED_ONLY_FIELDS })
          continue
        }
        const entry = await loadEntry(
          ctx.supabase,
          workspace.id,
          current.debt_entries.id
        )
        if (!entry) {
          errors.push({ index, message: NOT_FOUND })
          continue
        }
        const entryChanged =
          parsed.data.amount !== before.amount ||
          parsed.data.occurred_on !== before.occurred_on ||
          parsed.data.occurred_time !== before.time
        const invalid = entryChanged
          ? validatePaymentChange(entry, { amount: parsed.data.amount })
          : null
        if (invalid) {
          errors.push({ index, field: "amount", message: invalid })
          continue
        }
        plans.push({
          kind: "linked",
          id: current.id,
          entry,
          amount: parsed.data.amount,
          occurred_on: parsed.data.occurred_on,
          occurred_time: parsed.data.occurred_time,
          note: parsed.data.note,
          noteChanged: parsed.data.note !== before.note,
          entryChanged
        })
        continue
      }

      if (
        after.type !== before.type ||
        after.category_id !== before.category_id
      ) {
        categoryChecks.push({
          index,
          categoryId: parsed.data.category_id,
          type: parsed.data.type,
          currentCategoryId: current.category_id
        })
      }
      if (after.account_id !== before.account_id) {
        accountChecks.push({
          index,
          accountId: parsed.data.account_id,
          field: "account_id"
        })
      }
      if (
        current.recurring_expense_id !== null &&
        parsed.data.type !== "expense"
      ) {
        errors.push({
          index,
          field: "type",
          message: "El pago de un gasto fijo debe ser un gasto"
        })
        continue
      }
      // Sin recurring_income_id: el enlace al ingreso fijo se conserva
      const { recurring_income_id: _keep, ...data } = parsed.data
      void _keep
      plans.push({ kind: "plain", id: current.id, data })
    }

    errors.push(
      ...(await categoryErrors(ctx, workspace.type, categoryChecks)),
      ...(await accountErrors(ctx, workspace.id, accountChecks))
    )
    if (errors.length > 0) {
      return batchError(errors.sort((a, b) => a.index - b.index))
    }

    if (args.dry_run) {
      return toolResult(
        `Vista previa: ${plans.length} movimientos editados en ${workspace.name}. No se guardó nada.`,
        { dry_run: true, rows: previews, currency: ctx.currency }
      )
    }

    // 2. Escribir en orden; si una falla, se deshacen las anteriores
    const summary = `${plans.length} ${plans.length === 1 ? "movimiento editado" : "movimientos editados"} en ${workspace.name}`
    const changes: RowChange[] = []
    const operation = {
      workspaceId: workspace.id,
      tool: "update_transactions",
      summary,
      changes
    }

    for (const [index, plan] of plans.entries()) {
      if (plan.kind === "plain") {
        const result = await updateTransactionRecord(
          ctx.supabase,
          workspace,
          plan.id,
          plan.data
        )
        if (!result.ok) {
          return midwayError(
            index,
            result,
            await compensateOperation(ctx, operation)
          )
        }
        changes.push({
          table: "transactions",
          rowId: plan.id,
          before: result.before,
          after: result.after
        })
        continue
      }

      // Pago de deuda: el abono manda y el trigger copia al movimiento
      const transactionBefore = currentById.get(plan.id)!
      const { debt_entries: _link, ...txBefore } = transactionBefore
      void _link

      if (plan.entryChanged) {
        const result = await updatePaymentEntry(ctx.supabase, plan.entry, {
          amount: plan.amount,
          occurred_on: plan.occurred_on,
          occurred_time: plan.occurred_time
        })
        if (!result.ok) {
          return midwayError(
            index,
            result,
            await compensateOperation(ctx, operation)
          )
        }
        changes.push({
          table: "debt_entries",
          rowId: plan.entry.id,
          before: entryRecord(plan.entry),
          after: result.after
        })
      }

      const noteUpdate = plan.noteChanged
        ? await ctx.supabase
            .from("transactions")
            .update({ note: plan.note })
            .eq("id", plan.id)
            .eq("workspace_id", workspace.id)
            .select("*")
            .maybeSingle()
        : await ctx.supabase
            .from("transactions")
            .select("*")
            .eq("id", plan.id)
            .maybeSingle()

      if (noteUpdate.error || !noteUpdate.data) {
        return midwayError(
          index,
          { error: "No se pudo guardar el movimiento. Intenta de nuevo" },
          await compensateOperation(ctx, operation)
        )
      }
      changes.push({
        table: "transactions",
        rowId: plan.id,
        before: txBefore,
        after: noteUpdate.data
      })
    }

    const operationId = await commitOperation(ctx, operation)
    return writeResult(ctx, {
      operationId,
      summary,
      ids: plans.map((p) => p.id)
    })
  }
})
