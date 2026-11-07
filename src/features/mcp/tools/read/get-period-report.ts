import { z } from "zod"
import { getCategoryTotals, getMonthlyTotals } from "@/features/reports/queries"
import { toolError, toolResult } from "../result"
import {
  defineTool,
  monthSchema,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"
import {
  MAX_REPORT_MONTHS,
  categoryRows,
  monthTotals,
  resolveMonthRange,
  totalsFor
} from "./report-helpers"

const DEFAULT_MONTHS = 6

const input = z.object({
  workspace_id: workspaceIdSchema,
  from: monthSchema
    .optional()
    .describe("Primer mes YYYY-MM. Por defecto, 6 meses hasta to."),
  to: monthSchema
    .optional()
    .describe("Último mes YYYY-MM. Por defecto, el mes actual.")
})

export const getPeriodReport = defineTool({
  name: "get_period_report",
  group: "read",
  title: "Reporte de un periodo",
  description: `Serie mes a mes de un periodo de hasta ${MAX_REPORT_MONTHS} meses (los mismos totales de get_month_summary), los totales del periodo y los totales por categoría de ingresos y de gastos, como la página de Reportes. Sirve para comparar meses.`,
  input,
  annotations: { readOnlyHint: true },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    const range = resolveMonthRange(args.from, args.to, DEFAULT_MONTHS)
    if ("error" in range) {
      return toolError(range.error)
    }

    const [monthly, income, expense] = await Promise.all([
      getMonthlyTotals(workspace.id, range.dateFrom, range.dateTo),
      getCategoryTotals(workspace.id, range.dateFrom, range.dateTo, "income"),
      getCategoryTotals(workspace.id, range.dateFrom, range.dateTo, "expense")
    ])

    const period = monthly.reduce(
      (sum, row) => ({
        income: sum.income + row.income,
        expense: sum.expense + row.expense,
        balance: sum.balance + row.balance,
        txCount: sum.txCount + row.txCount
      }),
      { income: 0, expense: 0, balance: 0, txCount: 0 }
    )

    return toolResult(
      `${workspace.name}, de ${range.from} a ${range.to} (${monthly.length} meses).`,
      {
        workspace_id: workspace.id,
        workspace_type: workspace.type,
        from: range.from,
        to: range.to,
        totals: totalsFor(workspace.type, period),
        series: monthly.map((row) => monthTotals(workspace.type, row)),
        category_totals: {
          income: categoryRows(income),
          expense: categoryRows(expense)
        },
        currency: ctx.currency
      }
    )
  }
})
