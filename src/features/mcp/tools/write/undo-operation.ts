import { z } from "zod"
import { SITE } from "@/config/site"
import { undoOperation as revert } from "../../operations"
import { toolError, toolResult } from "../result"
import { defineTool } from "../shared"

const input = z.object({
  operation_id: z
    .uuid({ error: "Usa el id de una operación de list_operations." })
    .describe("Id de la operación (de list_operations o de una escritura).")
})

export const undoOperation = defineTool({
  name: "undo_operation",
  group: "undo",
  title: "Revertir una operación",
  description: `Revierte una escritura del MCP por su operation_id: borra lo creado, recrea lo borrado con sus mismos ids y devuelve lo editado. Todo o nada: si alguna fila cambió después (p. ej. desde la app), no revierte ninguna. Se revierte una sola vez y hasta ${SITE.mcp.undoWindowDays} días después; no hay rehacer.`,
  input,
  annotations: { destructiveHint: true },
  async run(ctx, { operation_id }) {
    const { data: operation } = await ctx.supabase
      .from("mcp_operations")
      .select("id, summary, row_count")
      .eq("id", operation_id)
      .eq("user_id", ctx.userId)
      .maybeSingle()

    if (!operation) {
      return toolError("No se encontró la operación.")
    }

    const result = await revert(ctx.supabase, operation.id)
    if (!result.ok) {
      return toolError(result.error)
    }

    return toolResult(`Operación revertida: ${operation.summary}.`, {
      operation_id: operation.id,
      status: "undone",
      row_count: operation.row_count
    })
  }
})
