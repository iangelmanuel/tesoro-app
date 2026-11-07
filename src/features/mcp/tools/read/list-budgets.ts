import { z } from "zod"
import { getBudgetProgress } from "@/features/budgets/queries"
import { currentMonth } from "@/libs/dates"
import { toolError, toolResult } from "../result"
import {
  PERSONAL_ONLY,
  defineTool,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"
import { monthInput } from "./report-helpers"

const input = z.object({
  workspace_id: workspaceIdSchema,
  month: monthInput
})

const round2 = (value: number) => Math.round(value * 100) / 100

export const listBudgets = defineTool({
  name: "list_budgets",
  group: "read",
  title: "Listar presupuestos",
  description:
    "Presupuestos de un mes por categoría de gasto con su progreso, como la página de Presupuestos: presupuesto, gastado, comprometido por gastos fijos pendientes, disponible y porcentaje usado. También las categorías con gastos y sin presupuesto. Solo Personal.",
  input,
  annotations: { readOnlyHint: true },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }
    if (workspace.type !== "personal") {
      return toolError(PERSONAL_ONLY)
    }

    const month = args.month ?? currentMonth()
    const rows = await getBudgetProgress(workspace.id, month)

    const budgets = rows
      .filter((row) => row.budgetAmount !== null)
      .map((row) => {
        const amount = row.budgetAmount ?? 0
        return {
          budget_id: row.budgetId,
          category_id: row.categoryId,
          category: row.name,
          amount,
          spent: row.spent,
          committed: row.committed,
          available: round2(amount - row.spent - row.committed),
          used_percent:
            amount === 0 ? null : Math.round((row.spent / amount) * 1000) / 10
        }
      })
    const unbudgeted = rows
      .filter((row) => row.budgetAmount === null)
      .map((row) => ({
        category_id: row.categoryId,
        category: row.name,
        spent: row.spent
      }))
    const exceeded = budgets.filter((row) => row.spent > row.amount).length

    return toolResult(
      `${budgets.length} presupuestos en ${month}${exceeded > 0 ? `, ${exceeded} excedidos` : ""}.`,
      {
        workspace_id: workspace.id,
        month,
        budgets,
        unbudgeted_categories: unbudgeted,
        currency: ctx.currency
      }
    )
  }
})
