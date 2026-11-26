import { z } from "zod"
import { SITE } from "@/config/site"
import {
  type RowChange,
  commitOperation,
  compensateOperation
} from "../../operations"
import type { McpContext } from "../../types"
import { toolError, toolResult } from "../result"
import {
  type McpWorkspace,
  NEEDS_INPUT_HINT,
  dateSchema,
  defineTool,
  needsInput,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"
import { batchError } from "./batch"
import {
  accountNameSchema,
  activeAccounts,
  activeCategories,
  resolveAccount
} from "./references"
import { analyzeStatement } from "./statement"
import { type StatementRow, statementRowsSchema } from "./statement-rows"

// Extracto bancario (SPEC 43): pone al día una cuenta con las filas que el
// agente leyó del extracto. Por defecto es una vista previa: duplicados
// probables, datos faltantes, categorías sugeridas y conciliación del saldo.

const input = z.object({
  workspace_id: workspaceIdSchema,
  account_id: z
    .uuid({ error: "Elige una cuenta válida" })
    .optional()
    .describe("Cuenta del extracto (de list_accounts)."),
  account: accountNameSchema.optional(),
  rows: statementRowsSchema.describe(
    `Filas del extracto, hasta ${SITE.mcp.statementLimit}.`
  ),
  dry_run: z
    .boolean()
    .default(true)
    .describe(
      "true (por defecto): vista previa sin guardar nada. Muéstrala al usuario antes de llamar con false."
    ),
  include_rows: z
    .array(z.number().int().min(0))
    .default([])
    .describe(
      "Índices de duplicados probables que sí se importan (por defecto se omiten)."
    ),
  statement_balance: z
    .number()
    .optional()
    .describe("Saldo final del extracto, para conciliar."),
  statement_end_date: dateSchema
    .optional()
    .describe(
      "Fecha de corte del extracto. Sin ella, la última fecha de las filas."
    )
})

export const importStatement = defineTool({
  name: "import_statement",
  group: "write",
  title: "Importar extracto",
  description: `Pone al día una cuenta con las filas de un extracto bancario (hasta ${SITE.mcp.statementLimit}): monto negativo = gasto, positivo = ingreso, y transfer_account_id para traspasos entre cuentas propias. Por defecto (dry_run true) no guarda nada y devuelve: filas listas (ready), duplicados probables (misma cuenta, tipo y monto a ±2 días; se omiten salvo que vayan en include_rows), datos faltantes (needsInput), categorías sugeridas por el historial y, con statement_balance, el saldo antes y después contra el extracto. Muestra la vista previa al usuario y luego llama con dry_run false: crea todo en una sola operación revertible con undo_operation. ${NEEDS_INPUT_HINT}`,
  input,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id, {
      writable: true
    })
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    const [accounts, categories] = await Promise.all([
      activeAccounts(ctx, workspace.id),
      activeCategories(ctx, workspace)
    ])

    const account = resolveAccount(accounts, {
      id: args.account_id,
      name: args.account,
      field: "account_id",
      label: "la cuenta del extracto",
      nullable: false
    })
    if ("missing" in account) {
      return needsInput([account.missing])
    }
    const accountId = account.value
    const accountName = accounts.find((item) => item.id === accountId)?.name
    if (!accountId || !accountName) {
      return toolError("La cuenta no existe en este espacio o está archivada.")
    }

    const analysis = await analyzeStatement(ctx, workspace, {
      accountId,
      rows: args.rows,
      accounts,
      categories,
      includeRows: args.include_rows,
      statementBalance: args.statement_balance,
      statementEndDate: args.statement_end_date
    })
    if ("errors" in analysis) {
      return batchError(analysis.errors)
    }
    if ("failure" in analysis) {
      return toolError(analysis.failure)
    }

    const { preview } = analysis
    if (args.dry_run) {
      const parts = [
        `${preview.ready.length} listas`,
        `${preview.duplicates.length} duplicados probables`,
        `${preview.needsInput.length} datos faltantes`
      ]
      const reconciliation = preview.reconciliation
        ? ` Saldo al ${preview.reconciliation.end_date}: ${preview.reconciliation.after} después de importar contra ${preview.reconciliation.statement} del extracto (diferencia ${preview.reconciliation.difference}).`
        : ""
      return toolResult(
        `Vista previa del extracto de ${accountName}: ${parts.join(", ")}. No se guardó nada.${reconciliation}`,
        {
          dry_run: true,
          account_id: accountId,
          ...preview,
          currency: ctx.currency
        }
      )
    }

    // Escritura real: nada se guarda si falta un dato de una fila a importar
    if (preview.needsInput.length > 0) {
      return needsInput(preview.needsInput)
    }
    const omitted = preview.duplicates
      .map((item) => item.row)
      .filter((row) => !analysis.toImport.includes(row))
    if (analysis.toImport.length === 0) {
      return toolResult(
        `Nada que importar en ${accountName}: todas las filas son duplicados probables. Agrega en include_rows las que sí van.`,
        {
          operation_id: null,
          row_count: 0,
          ids: [],
          omitted_duplicates: omitted
        }
      )
    }

    const selected = analysis.rows.filter((row) =>
      analysis.toImport.includes(row.index)
    )
    const written = await writeStatementRows(
      ctx,
      workspace,
      accountId,
      selected
    )
    const summary = `${selected.length} ${selected.length === 1 ? "fila importada" : "filas importadas"} del extracto de ${accountName}`
    const operation = {
      workspaceId: workspace.id,
      tool: "import_statement",
      summary,
      changes: written.changes
    }

    if (!written.ok) {
      const compensation = await compensateOperation(ctx, operation)
      return toolError(
        compensation.compensated
          ? `No se guardó nada: ${written.error}`
          : `${written.error} No se pudo deshacer lo que alcanzó a guardarse: revierte la operación ${compensation.operationId ?? ""} desde Tesoro → Cuenta → Agentes IA.`,
        {
          operation_id: compensation.operationId,
          compensated: compensation.compensated
        }
      )
    }

    const operationId = await commitOperation(ctx, operation)
    return toolResult(
      operationId
        ? `${summary}. ${omitted.length > 0 ? `Se omitieron ${omitted.length} duplicados probables. ` : ""}Para deshacerlo: undo_operation con ${operationId}.`
        : `${summary}. No se pudo registrar para revertir.`,
      {
        operation_id: operationId,
        row_count: written.changes.length,
        summary,
        ids: written.changes.map((change) => change.rowId),
        omitted_duplicates: omitted,
        reconciliation: preview.reconciliation ?? null,
        currency: ctx.currency
      }
    )
  }
})

type WriteResult =
  | { ok: true; changes: RowChange[] }
  | { ok: false; error: string; changes: RowChange[] }

/**
 * Crea los movimientos y los traspasos del extracto en bloque: un insert por
 * tabla (cada uno es todo o nada). Si el segundo falla, los cambios del
 * primero vuelven para compensar.
 */
async function writeStatementRows(
  ctx: McpContext,
  workspace: McpWorkspace,
  accountId: string,
  rows: StatementRow[]
): Promise<WriteResult> {
  const changes: RowChange[] = []
  const business = workspace.type === "business"

  const transactions = rows.filter((row) => row.kind !== "transfer")
  if (transactions.length > 0) {
    const { data, error } = await ctx.supabase
      .from("transactions")
      .insert(
        transactions.map((row) => ({
          workspace_id: workspace.id,
          type:
            row.kind === "income" ? ("income" as const) : ("expense" as const),
          amount: row.amount,
          category_id: row.categoryId ?? "",
          occurred_on: row.date,
          occurred_time: row.time,
          description: row.description,
          note: row.note,
          account_id: accountId,
          ...(business ? {} : { counterparty: null, invoice_ref: null })
        }))
      )
      .select("*")
    if (error) {
      return { ok: false, error: writeError(error), changes }
    }
    for (const after of data) {
      changes.push({
        table: "transactions",
        rowId: after.id,
        before: null,
        after
      })
    }
  }

  const transfers = rows.filter((row) => row.kind === "transfer")
  if (transfers.length > 0) {
    const { data, error } = await ctx.supabase
      .from("transfers")
      .insert(
        transfers.map((row) => ({
          workspace_id: workspace.id,
          from_account_id:
            row.direction === "out" ? accountId : (row.transferAccountId ?? ""),
          to_account_id:
            row.direction === "out" ? (row.transferAccountId ?? "") : accountId,
          amount: row.amount,
          occurred_on: row.date,
          occurred_time: row.time,
          note: row.note ?? row.description
        }))
      )
      .select("*")
    if (error) {
      return { ok: false, error: writeError(error), changes }
    }
    for (const after of data) {
      changes.push({ table: "transfers", rowId: after.id, before: null, after })
    }
  }

  return { ok: true, changes }
}

function writeError(error: { code: string; message: string }) {
  // Un trigger o un check rechazó una fila: su mensaje ya está en español
  return error.code === "23514" || error.code === "P0001"
    ? `No se pudo importar el extracto: ${error.message}`
    : "No se pudo importar el extracto. Intenta de nuevo."
}
