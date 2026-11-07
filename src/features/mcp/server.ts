import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { SITE } from "@/config/site"
import { runWithSupabaseClient } from "@/libs/supabase/server"
import { MCP_TOOLS } from "./catalog"
import { toolError } from "./tools/result"
import type { McpContext, McpTool } from "./types"

// Servidor MCP de una llamada (sin estado, SPEC 34). Se crea por request con
// el contexto del agente y registra las tools que su acceso permite.

const INSTRUCTIONS = `Tesoro es un gestor de finanzas personales y de empresas. Empieza con list_workspaces para obtener el workspace_id. Fechas YYYY-MM-DD, meses YYYY-MM y horas HH:MM, en America/Bogota. Los montos son números positivos en la moneda que trae cada respuesta.`

export const READ_ONLY_ERROR =
  "Esta conexión es de solo lectura. Cámbiala en Tesoro → Cuenta → Agentes IA."

/** Escrituras y revertir: solo con acceso 'write' */
export function isWriteTool(tool: Pick<McpTool, "group">) {
  return tool.group !== "read"
}

const WRITE_TOOL_NAMES = new Set(
  MCP_TOOLS.filter(isWriteTool).map((tool) => tool.name)
)

/**
 * Con acceso de solo lectura, una llamada a una tool de escritura responde
 * el error del spec en vez del "Tool disabled" del SDK. Devuelve la
 * respuesta JSON-RPC, o null si la llamada sigue su curso.
 */
export function readOnlyCallResponse(
  ctx: McpContext,
  body: unknown
): Response | null {
  if (ctx.access === "write" || typeof body !== "object" || body === null) {
    return null
  }
  const message = body as {
    jsonrpc?: unknown
    id?: unknown
    method?: unknown
    params?: { name?: unknown }
  }
  if (
    message.method !== "tools/call" ||
    typeof message.params?.name !== "string" ||
    !WRITE_TOOL_NAMES.has(message.params.name) ||
    message.id === undefined
  ) {
    return null
  }
  return Response.json(
    { jsonrpc: "2.0", id: message.id, result: toolError(READ_ONLY_ERROR) },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export function createMcpServer(ctx: McpContext) {
  const server = new McpServer(
    { name: SITE.info.name, version: SITE.info.version },
    { instructions: INSTRUCTIONS }
  )

  for (const tool of MCP_TOOLS) {
    const blocked = isWriteTool(tool) && ctx.access !== "write"
    const registered = server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        annotations: { title: tool.title, ...tool.annotations }
      },
      async (input) => {
        // Defensa: aunque la llamada llegue, sin 'write' no escribe
        if (blocked) {
          return toolError(READ_ONLY_ERROR)
        }
        try {
          // También aquí: el contexto debe valer aunque el SDK cambie cómo
          // despacha los handlers
          return await runWithSupabaseClient(ctx.supabase, () =>
            tool.run(ctx, input)
          )
        } catch {
          return toolError("Algo falló en Tesoro. Intenta de nuevo.")
        }
      }
    )
    // Fuera de tools/list
    if (blocked) {
      registered.disable()
    }
  }

  return server
}
