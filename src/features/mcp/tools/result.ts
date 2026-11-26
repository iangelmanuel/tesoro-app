import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"

// Respuestas de las tools (SPEC 34): structuredContent (JSON) más un texto
// corto que lo resume. Los errores van con isError para que el agente los
// lea y corrija, en español.

/** Respuesta de una tool: resumen en texto y el JSON */
export function toolResult(
  summary: string,
  data: Record<string, unknown>
): CallToolResult {
  return {
    content: [{ type: "text", text: summary }],
    structuredContent: data
  }
}

/** Error de una tool, con detalles opcionales en el JSON */
export function toolError(
  message: string,
  details?: Record<string, unknown>
): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
    ...(details ? { structuredContent: { error: message, ...details } } : {})
  }
}
