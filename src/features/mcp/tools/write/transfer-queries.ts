import type { McpContext } from "../../types"
import type { McpWorkspace } from "../shared"

/**
 * Traspasos del espacio por id, para editar o borrar (SPEC 34). null si la
 * lectura falla.
 */
export async function loadTransfers(
  ctx: McpContext,
  workspace: McpWorkspace,
  ids: string[]
) {
  const { data, error } = await ctx.supabase
    .from("transfers")
    .select("*")
    .eq("workspace_id", workspace.id)
    .in("id", [...new Set(ids)])
  return error ? null : new Map(data.map((row) => [row.id, row]))
}
