import { z } from "zod"
import type { McpTool } from "../../types"
import { toolError, toolResult } from "../result"

const input = z.object({})

export const listWorkspaces: McpTool<typeof input> = {
  name: "list_workspaces",
  group: "read",
  title: "Listar espacios",
  description:
    "Lista los espacios del usuario: Personal y sus empresas. Cada uno trae id, tipo (personal o business), nombre y si está marcado para borrar. Usa el id como workspace_id en las demás tools.",
  input,
  annotations: { readOnlyHint: true },
  async run(ctx) {
    // RLS de workspaces: solo los del dueño del token
    const { data, error } = await ctx.supabase
      .from("workspaces")
      .select("id, type, name, deletion_requested_at")
      // El enum ordena 'personal' antes que 'business'
      .order("type", { ascending: true })
      .order("created_at", { ascending: true })

    if (error) {
      return toolError("No se pudieron cargar los espacios.")
    }

    const workspaces = data.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      marked_for_deletion: row.deletion_requested_at !== null
    }))
    const businesses = workspaces.filter((w) => w.type === "business").length

    return toolResult(
      businesses === 0
        ? "Tienes el espacio Personal."
        : `Tienes el espacio Personal y ${businesses} ${businesses === 1 ? "empresa" : "empresas"}.`,
      { workspaces, currency: ctx.currency }
    )
  }
}
