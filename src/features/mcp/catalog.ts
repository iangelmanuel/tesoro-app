import { getAccountBalance } from "./tools/read/get-account-balance"
import { getCashFlow } from "./tools/read/get-cash-flow"
import { getMonthSummary } from "./tools/read/get-month-summary"
import { getPeriodReport } from "./tools/read/get-period-report"
import { getRecommendationsTool } from "./tools/read/get-recommendations"
import { getScore } from "./tools/read/get-score"
import { getSpendingBreakdown } from "./tools/read/get-spending-breakdown"
import { getTransaction } from "./tools/read/get-transaction"
import { listAccounts } from "./tools/read/list-accounts"
import { listBudgets } from "./tools/read/list-budgets"
import { listCategories } from "./tools/read/list-categories"
import { listDebts } from "./tools/read/list-debts"
import { listGoals } from "./tools/read/list-goals"
import { listOperations } from "./tools/read/list-operations"
import { listReceivables } from "./tools/read/list-receivables"
import { listRecurring } from "./tools/read/list-recurring"
import { listTransactions } from "./tools/read/list-transactions"
import { listTransfers } from "./tools/read/list-transfers"
import { listUpcomingPayments } from "./tools/read/list-upcoming-payments"
import { listWorkspaces } from "./tools/read/list-workspaces"
import { createAccountTool, updateAccountTool } from "./tools/write/accounts"
import { setBudgetTool } from "./tools/write/budgets"
import { collectReceivable } from "./tools/write/collect-receivable"
import { createCategory } from "./tools/write/create-category"
import { createDebtTool } from "./tools/write/create-debt"
import { createReceivableTool } from "./tools/write/create-receivable"
import { createRecurringIncomeTool } from "./tools/write/create-recurring-income"
import { createTransactions } from "./tools/write/create-transactions"
import { createTransfers } from "./tools/write/create-transfers"
import { deleteDebtEntry } from "./tools/write/delete-debt-entry"
import { deleteTransactions } from "./tools/write/delete-transactions"
import { deleteTransfers } from "./tools/write/delete-transfers"
import { recordGoalContribution } from "./tools/write/goals"
import { importStatement } from "./tools/write/import-statement"
import { recordDebtPayment } from "./tools/write/record-debt-payment"
import {
  payRecurringExpense,
  receiveRecurringIncome
} from "./tools/write/recurring"
import {
  createRecurringExpenseTool,
  updateRecurringExpenseTool
} from "./tools/write/recurring-expenses"
import { createGoalTool, updateGoalTool } from "./tools/write/savings-goals"
import { undoOperation } from "./tools/write/undo-operation"
import { updateDebtTool } from "./tools/write/update-debt"
import { updateDebtEntry } from "./tools/write/update-debt-entry"
import { updateReceivableTool } from "./tools/write/update-receivable"
import { updateRecurringIncomeTool } from "./tools/write/update-recurring-income"
import { updateTransactions } from "./tools/write/update-transactions"
import { updateTransfers } from "./tools/write/update-transfers"
import type { McpTool, McpToolDefinition } from "./types"

// Catálogo único de tools (SPEC 34): el servidor las registra desde aquí y
// la página /mcp las lista desde aquí. Agregar una tool = un archivo en
// tools/ y una línea en esta lista.

/** Todas las tools del servidor, en el orden de tools/list */
export const MCP_TOOLS: readonly McpTool[] = [
  listWorkspaces,
  listAccounts,
  listCategories,
  listTransactions,
  getTransaction,
  listTransfers,
  getMonthSummary,
  getPeriodReport,
  getCashFlow,
  getScore,
  getRecommendationsTool,
  getSpendingBreakdown,
  getAccountBalance,
  listUpcomingPayments,
  listBudgets,
  listGoals,
  listDebts,
  listRecurring,
  listReceivables,
  listOperations,
  createTransactions,
  updateTransactions,
  deleteTransactions,
  createTransfers,
  updateTransfers,
  deleteTransfers,
  createCategory,
  importStatement,
  recordDebtPayment,
  collectReceivable,
  updateDebtEntry,
  deleteDebtEntry,
  payRecurringExpense,
  receiveRecurringIncome,
  recordGoalContribution,
  // Crear y editar entidades (SPEC 44), por entidad
  createAccountTool,
  updateAccountTool,
  createDebtTool,
  updateDebtTool,
  createReceivableTool,
  updateReceivableTool,
  createRecurringExpenseTool,
  updateRecurringExpenseTool,
  createRecurringIncomeTool,
  updateRecurringIncomeTool,
  createGoalTool,
  updateGoalTool,
  setBudgetTool,
  undoOperation
]

/** Nombre de cada grupo de tools en la página /mcp */
export const MCP_GROUP_LABELS: Record<McpToolDefinition["group"], string> = {
  read: "Lectura",
  write: "Escritura",
  manage: "Crear y editar",
  undo: "Revertir"
}

/** Definiciones sin el código que las ejecuta, para mostrarlas */
export function getMcpCatalog(): McpToolDefinition[] {
  return MCP_TOOLS.map((tool) => ({
    name: tool.name,
    group: tool.group,
    title: tool.title,
    description: tool.description,
    input: tool.input,
    annotations: tool.annotations
  }))
}
