import { z } from "zod"
import { getCashFlow as loadCashFlow } from "@/features/cash-flow/queries"
import { toolError, toolResult } from "../result"
import {
  defineTool,
  monthSchema,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"
import { MAX_REPORT_MONTHS, resolveMonthRange } from "./report-helpers"

const DEFAULT_MONTHS = 12

const input = z.object({
  workspace_id: workspaceIdSchema,
  from: monthSchema
    .optional()
    .describe("Primer mes YYYY-MM. Por defecto, 12 meses hasta to."),
  to: monthSchema
    .optional()
    .describe("Último mes YYYY-MM. Por defecto, el mes actual.")
})

export const getCashFlow = defineTool({
  name: "get_cash_flow",
  group: "read",
  title: "Flujo de caja",
  description: `Flujo de caja de una empresa mes a mes (hasta ${MAX_REPORT_MONTHS} meses): entradas, salidas, neto y saldo en cuentas al cierre de cada mes, como la página Flujo de caja. Solo para espacios de Empresa.`,
  input,
  annotations: { readOnlyHint: true },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }
    if (workspace.type !== "business") {
      return toolError("Solo disponible en espacios de Empresa.")
    }

    const range = resolveMonthRange(args.from, args.to, DEFAULT_MONTHS)
    if ("error" in range) {
      return toolError(range.error)
    }

    const cashFlow = await loadCashFlow(
      workspace.id,
      range.dateFrom,
      range.dateTo
    )

    return toolResult(
      `Flujo de caja de ${workspace.name}, de ${range.from} a ${range.to}.`,
      {
        workspace_id: workspace.id,
        from: range.from,
        to: range.to,
        months: cashFlow.months.map((row) => ({
          month: row.month.slice(0, 7),
          inflow: row.inflow,
          outflow: row.outflow,
          net: row.net,
          closing_balance: row.closingBalance,
          transaction_count: row.txCount
        })),
        // Suman en entradas y salidas, pero no mueven el saldo
        transactions_without_account: cashFlow.withoutAccount,
        currency: ctx.currency
      }
    )
  }
})
