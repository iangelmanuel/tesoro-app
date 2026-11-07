import { z } from "zod"
import { SITE } from "@/config/site"
import { canUndo } from "../../operations"
import { toolError, toolResult } from "../result"
import { defineTool } from "../shared"

const STATUS_LABELS = {
  applied: "Aplicada",
  undone: "Revertida",
  failed: "Fallida"
} as const

const input = z.object({
  all_connections: z
    .boolean()
    .default(false)
    .describe(
      "true: las de todos los agentes conectados. false: solo las de este agente."
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Cuántas operaciones (1–100, por defecto 20).")
})

export const listOperations = defineTool({
  name: "list_operations",
  group: "read",
  title: "Historial de operaciones",
  description: `Escrituras hechas desde el MCP, de la más reciente a la más antigua: herramienta, resumen, espacio, estado (Aplicada, Revertida o Fallida) y si todavía se puede revertir con undo_operation (${SITE.mcp.undoWindowDays} días).`,
  input,
  annotations: { readOnlyHint: true },
  async run(ctx, args) {
    let query = ctx.supabase
      .from("mcp_operations")
      .select(
        "id, client_id, tool, summary, row_count, status, created_at, undone_at, workspaces(id, name)"
      )
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(args.limit)

    if (!args.all_connections) {
      query = query.eq("client_id", ctx.clientId)
    }

    const [{ data, error }, { data: connections }] = await Promise.all([
      query,
      ctx.supabase
        .from("mcp_connections")
        .select("client_id, client_name")
        .eq("user_id", ctx.userId)
    ])

    if (error) {
      return toolError("No se pudo cargar el historial.")
    }

    const names = new Map(
      (connections ?? []).map((row) => [row.client_id, row.client_name])
    )
    const now = Date.now()
    const operations = data.map((row) => ({
      id: row.id,
      tool: row.tool,
      summary: row.summary,
      row_count: row.row_count,
      status: row.status,
      status_label: STATUS_LABELS[row.status],
      created_at: row.created_at,
      undone_at: row.undone_at,
      workspace: row.workspaces,
      agent: names.get(row.client_id) ?? null,
      this_agent: row.client_id === ctx.clientId,
      can_undo: canUndo(row, now)
    }))

    return toolResult(`${operations.length} operaciones.`, { operations })
  }
})
