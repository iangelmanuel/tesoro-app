import { z } from "zod"
import { SITE } from "@/config/site"
import { toolError, toolResult } from "../result"
import {
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
import { analyzeStatement, statementRowsSchema } from "./statement"

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

    // La importación real llega en el paso 4 de SPEC 43
    return toolError("Importar extracto aún no está disponible.")
  }
})
