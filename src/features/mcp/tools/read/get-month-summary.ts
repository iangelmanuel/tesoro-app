import { z } from "zod"
import { getCashFlow } from "@/features/cash-flow/queries"
import { getCategoryTotals, getMonthlyTotals } from "@/features/reports/queries"
import { currentMonth, monthRange, shiftMonth } from "@/libs/dates"
import { toolError, toolResult } from "../result"
import { defineTool, resolveWorkspace, workspaceIdSchema } from "../shared"
import { categoryRows, monthInput, monthTotals } from "./report-helpers"

const TOP_CATEGORIES = 5

const input = z.object({
  workspace_id: workspaceIdSchema,
  month: monthInput
})

export const getMonthSummary = defineTool({
  name: "get_month_summary",
  group: "read",
  title: "Resumen del mes",
  description:
    "Totales de un mes, iguales a la página de Resumen. Personal: ingresos, gastos, balance y tasa de ahorro. Empresa: ventas, costos y gastos, utilidad y margen. En ambos: saldo en cuentas al inicio y al cierre del mes, y las 5 categorías con más gasto (o costo).",
  input,
  annotations: { readOnlyHint: true },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    const month = args.month ?? currentMonth()
    const { from, to } = monthRange(month)
    const previousFrom = monthRange(shiftMonth(month, -1)).from

    const [monthly, cashFlow, expenseCategories] = await Promise.all([
      getMonthlyTotals(workspace.id, from, to),
      // Saldo en cuentas al cierre del mes anterior (inicio) y del mes
      getCashFlow(workspace.id, previousFrom, to),
      getCategoryTotals(workspace.id, from, to, "expense")
    ])

    const totals = monthly[0] ?? {
      month: from,
      income: 0,
      expense: 0,
      balance: 0,
      txCount: 0
    }
    const [previous, current] = cashFlow.months
    const categoriesKey =
      workspace.type === "business"
        ? "top_cost_categories"
        : "top_expense_categories"

    const summary = {
      ...monthTotals(workspace.type, totals),
      opening_balance: previous?.closingBalance ?? 0,
      closing_balance: current?.closingBalance ?? 0,
      [categoriesKey]: categoryRows(expenseCategories, TOP_CATEGORIES)
    }

    const headline =
      workspace.type === "business"
        ? `ventas ${totals.income}, costos y gastos ${totals.expense}, utilidad ${totals.balance}`
        : `ingresos ${totals.income}, gastos ${totals.expense}, balance ${totals.balance}`

    return toolResult(`${workspace.name}, ${month}: ${headline}.`, {
      workspace_id: workspace.id,
      workspace_type: workspace.type,
      summary,
      currency: ctx.currency
    })
  }
})
