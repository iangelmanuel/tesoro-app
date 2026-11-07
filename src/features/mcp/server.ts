import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { SITE } from "@/config/site"
import { runWithSupabaseClient } from "@/libs/supabase/server"
import { MCP_TOOLS } from "./catalog"
import { toolError } from "./tools/result"
import type { McpContext } from "./types"

// Servidor MCP de una llamada (sin estado, SPEC 34). Se crea por request con
// el contexto del agente y registra las tools que su acceso permite.

const INSTRUCTIONS = `Tesoro es un gestor de finanzas personales y de empresas. Empieza con list_workspaces para obtener el workspace_id. Fechas YYYY-MM-DD, meses YYYY-MM y horas HH:MM, en America/Bogota. Los montos son números positivos en la moneda que trae cada respuesta.`

export function createMcpServer(ctx: McpContext) {
  const server = new McpServer(
    { name: SITE.info.name, version: SITE.info.version },
    { instructions: INSTRUCTIONS }
  )

  for (const tool of MCP_TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        annotations: { title: tool.title, ...tool.annotations }
      },
      async (input) => {
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
  }

  return server
}
