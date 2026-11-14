import { z } from "zod"
import { OCCURRENCE_STATUS } from "@/features/recurring-expenses/occurrences"
import { getUpcomingPayments } from "@/features/recurring-expenses/queries"
import { INCOME_OCCURRENCE_STATUS } from "@/features/recurring-incomes/occurrences"
import { getUpcomingIncomes } from "@/features/recurring-incomes/queries"
import { currentMonth } from "@/libs/dates"
import { toolError, toolResult } from "../result"
import {
  PERSONAL_ONLY,
  defineTool,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"

const input = z.object({ workspace_id: workspaceIdSchema })

export const listRecurring = defineTool({
  name: "list_recurring",
  group: "read",
  title: "Listar gastos e ingresos fijos",
  description:
    "Gastos e ingresos fijos del mes actual con su estado, igual que las páginas de Gastos fijos e Ingresos fijos (ambos incluyen todos los sin pagar o sin recibir de meses anteriores). Gastos: Pagado, Hoy, Próximo o Atrasado. Ingresos: Recibido, Abonado (recibió una parte: ver remaining), De hoy, Pendiente o Atrasado. Un ingreso puede cubrir varias ocurrencias. Solo Personal.",
  input,
  annotations: { readOnlyHint: true },
  async run(ctx, { workspace_id }) {
    const workspace = await resolveWorkspace(ctx, workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }
    if (workspace.type !== "personal") {
      return toolError(PERSONAL_ONLY)
    }

    const [payments, incomes] = await Promise.all([
      getUpcomingPayments(workspace.id),
      getUpcomingIncomes(workspace.id)
    ])

    const expenses = payments.map((row) => ({
      recurring_expense_id: row.recurringExpenseId,
      name: row.name,
      category: { id: row.category.id, name: row.category.name },
      amount: row.amount,
      due_on: row.dueOn,
      status: row.status,
      status_label: OCCURRENCE_STATUS[row.status].label,
      paid_amount: row.paidAmount,
      transaction_id: row.transactionId,
      account: row.accountName
    }))
    const received = incomes.map((row) => ({
      recurring_income_id: row.recurringIncomeId,
      name: row.name,
      category: { id: row.category.id, name: row.category.name },
      amount: row.amount,
      due_on: row.dueOn,
      status: row.status,
      status_label: INCOME_OCCURRENCE_STATUS[row.status].label,
      // Suma de los ingresos asignados a la ocurrencia (SPEC 38): puede
      // venir de varios movimientos, o ser parcial (status "partial")
      received_amount: row.receivedAmount,
      remaining: row.remaining
    }))

    const pendingExpenses = expenses.filter((row) => row.status !== "paid")
    const pendingIncomes = received.filter((row) => row.status !== "received")

    return toolResult(
      `${currentMonth()}: ${pendingExpenses.length} gastos fijos sin pagar y ${pendingIncomes.length} ingresos fijos sin recibir.`,
      {
        workspace_id: workspace.id,
        month: currentMonth(),
        recurring_expenses: expenses,
        recurring_incomes: received,
        currency: ctx.currency
      }
    )
  }
})
