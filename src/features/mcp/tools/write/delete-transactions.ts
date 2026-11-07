import { z } from "zod"
import {
  type LoadedEntry,
  deleteEntryRecord,
  entryRecord,
  loadEntry
} from "@/features/debts/entry-service"
import { DEBT_NOT_ACTIVE } from "@/features/debts/errors"
import {
  NOT_FOUND,
  type TransactionRow,
  deleteTransactionRecord
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
  batchError,
  bulk,
  dryRunSchema,
  duplicateIdErrors,
  midwayError,
  writeResult
} from "./batch"

const input = z.object({
  workspace_id: workspaceIdSchema,
  ids: bulk(z.uuid({ error: NOT_FOUND }), "id").describe(
    "Ids de los movimientos a borrar."
  ),
  dry_run: dryRunSchema
})

type CurrentRow = TransactionRow & { debt_entries: { id: string } | null }

type Plan =
  | { kind: "plain"; row: TransactionRow }
  | { kind: "linked"; row: TransactionRow; entry: LoadedEntry }

function withoutLink({ debt_entries, ...row }: CurrentRow): TransactionRow {
  void debt_entries
  return row
}

export const deleteTransactions = defineTool({
  name: "delete_transactions",
  group: "write",
  title: "Borrar movimientos",
  description:
    "Borra de 1 a 200 movimientos por id. Un pago de deuda o cobro de Me deben se borra con su abono, como en la app. Todo o nada, con dry_run. Se puede deshacer con undo_operation durante 30 días: los movimientos vuelven con sus mismos ids y vínculos.",
  input,
  annotations: { readOnlyHint: false, destructiveHint: true },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id, {
      writable: true
    })
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    const errors: RowError[] = duplicateIdErrors(args.ids)
    const { data: found, error: loadError } = await ctx.supabase
      .from("transactions")
      .select("*, debt_entries(id)")
      .eq("workspace_id", workspace.id)
      .in("id", [...new Set(args.ids)])
    if (loadError) {
      return toolError("No se pudieron cargar los movimientos.")
    }
    const currentById = new Map(
      (found as CurrentRow[]).map((row) => [row.id, row])
    )

    // 1. Validar que existan y que sus deudas admitan el borrado
    const plans: Plan[] = []
    for (const [index, id] of args.ids.entries()) {
      const current = currentById.get(id)
      if (!current) {
        errors.push({ index, message: NOT_FOUND })
        continue
      }
      const row = withoutLink(current)
      if (!current.debt_entries) {
        plans.push({ kind: "plain", row })
        continue
      }
      const entry = await loadEntry(
        ctx.supabase,
        workspace.id,
        current.debt_entries.id
      )
      if (!entry) {
        errors.push({ index, message: NOT_FOUND })
      } else if (entry.debt.status !== "active") {
        errors.push({ index, message: DEBT_NOT_ACTIVE })
      } else {
        plans.push({ kind: "linked", row, entry })
      }
    }

    if (errors.length > 0) {
      return batchError(errors.sort((a, b) => a.index - b.index))
    }

    if (args.dry_run) {
      return toolResult(
        `Vista previa: ${plans.length} movimientos borrados en ${workspace.name}. No se borró nada.`,
        {
          dry_run: true,
          rows: plans.map((plan, index) => ({
            index,
            before: {
              id: plan.row.id,
              type: plan.row.type,
              amount: Number(plan.row.amount),
              occurred_on: plan.row.occurred_on,
              time: formatTime(plan.row.occurred_time),
              description: plan.row.description,
              with_debt_entry: plan.kind === "linked"
            },
            after: null
          })),
          currency: ctx.currency
        }
      )
    }

    // 2. Borrar en orden; si uno falla, se restauran los anteriores
    const summary = `${plans.length} ${plans.length === 1 ? "movimiento borrado" : "movimientos borrados"} en ${workspace.name}`
    const changes: RowChange[] = []
    const operation = {
      workspaceId: workspace.id,
      tool: "delete_transactions",
      summary,
      changes
    }

    for (const [index, plan] of plans.entries()) {
      if (plan.kind === "plain") {
        const result = await deleteTransactionRecord(
          ctx.supabase,
          workspace,
          plan.row.id
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
          rowId: plan.row.id,
          before: result.before,
          after: null
        })
        continue
      }

      // El trigger borra el movimiento con su abono. Al revertir se recrea
      // primero el movimiento y luego el abono que lo enlaza
      const result = await deleteEntryRecord(ctx.supabase, plan.entry)
      if (!result.ok) {
        return midwayError(
          index,
          result,
          await compensateOperation(ctx, operation)
        )
      }
      changes.push(
        {
          table: "debt_entries",
          rowId: plan.entry.id,
          before: entryRecord(plan.entry),
          after: null
        },
        {
          table: "transactions",
          rowId: plan.row.id,
          before: plan.row,
          after: null
        }
      )
    }

    const operationId = await commitOperation(ctx, operation)
    return writeResult(ctx, {
      operationId,
      summary,
      ids: plans.map((plan) => plan.row.id)
    })
  }
})
