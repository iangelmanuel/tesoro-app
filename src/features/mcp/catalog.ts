import { getTransaction } from "./tools/read/get-transaction"
import { listAccounts } from "./tools/read/list-accounts"
import { listCategories } from "./tools/read/list-categories"
import { listTransactions } from "./tools/read/list-transactions"
import { listTransfers } from "./tools/read/list-transfers"
import { listWorkspaces } from "./tools/read/list-workspaces"
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
  listTransfers
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
