import { getCashFlow } from "./tools/read/get-cash-flow"
import { getMonthSummary } from "./tools/read/get-month-summary"
import { getPeriodReport } from "./tools/read/get-period-report"
import { getScore } from "./tools/read/get-score"
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
import { listWorkspaces } from "./tools/read/list-workspaces"
import { createTransactions } from "./tools/write/create-transactions"
import { deleteTransactions } from "./tools/write/delete-transactions"
import { undoOperation } from "./tools/write/undo-operation"
import { updateTransactions } from "./tools/write/update-transactions"
import type { McpTool, McpToolDefinition } from "./types"

// Catálogo único de tools (SPEC 34): el servidor las registra desde aquí y
// la página /mcp las lista desde aquí. Agregar una tool = un archivo en
// tools/ y una línea en esta lista.

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
  listBudgets,
  listGoals,
  listDebts,
  listRecurring,
  listReceivables,
  listOperations,
  createTransactions,
  updateTransactions,
  deleteTransactions,
  undoOperation
]

export const MCP_GROUP_LABELS: Record<McpToolDefinition["group"], string> = {
  read: "Lectura",
  write: "Escritura",
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
