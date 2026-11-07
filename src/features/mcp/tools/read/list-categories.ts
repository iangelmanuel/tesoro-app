import { z } from "zod"
import { TRANSACTION_TYPES } from "@/features/categories/constants"
import { toolError, toolResult } from "../result"
import { defineTool, resolveWorkspace, workspaceIdSchema } from "../shared"

const input = z.object({
  workspace_id: workspaceIdSchema,
  type: z
    .enum(TRANSACTION_TYPES)
    .optional()
    .describe("income (ingreso) o expense (gasto). Sin él, ambas."),
  include_archived: z
    .boolean()
    .default(false)
    .describe("Incluir las categorías archivadas.")
})

export const listCategories = defineTool({
  name: "list_categories",
  group: "read",
  title: "Listar categorías",
  description:
    "Categorías del espacio por tipo (income o expense): las del sistema y las propias. Un movimiento necesita una categoría de su mismo tipo. Si falta una, créala con create_category.",
  input,
  annotations: { readOnlyHint: true },
  async run(ctx, { workspace_id, type, include_archived }) {
    const workspace = await resolveWorkspace(ctx, workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    // Del sistema (sin espacio) del scope del espacio, o propias del espacio
    let query = ctx.supabase
      .from("categories")
      .select("id, name, type, workspace_id, archived_at")
      .eq("scope", workspace.type)
      .or(`workspace_id.is.null,workspace_id.eq.${workspace.id}`)
      .order("type", { ascending: true })
      .order("name", { ascending: true })

    if (type) {
      query = query.eq("type", type)
    }
    if (!include_archived) {
      query = query.is("archived_at", null)
    }

    const { data, error } = await query
    if (error) {
      return toolError("No se pudieron cargar las categorías.")
    }

    const categories = data.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      system: row.workspace_id === null,
      archived: row.archived_at !== null
    }))

    return toolResult(`${categories.length} categorías en ${workspace.name}.`, {
      workspace_id: workspace.id,
      categories
    })
  }
})
