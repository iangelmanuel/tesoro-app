import { z } from "zod"
import { toolError, toolResult } from "../result"
import { defineTool, resolveWorkspace, workspaceIdSchema } from "../shared"

const input = z.object({
  workspace_id: workspaceIdSchema,
  include_archived: z
    .boolean()
    .default(false)
    .describe("Incluir las cuentas archivadas.")
})

export const listAccounts = defineTool({
  name: "list_accounts",
  group: "read",
  title: "Listar cuentas",
  description:
    "Cuentas del espacio (efectivo, banco, billetera…) con su saldo a hoy, el saldo con lo programado a futuro, su tipo y si está archivada. Usa el id como account_id al registrar movimientos o traspasos.",
  input,
  annotations: { readOnlyHint: true },
  async run(ctx, { workspace_id, include_archived }) {
    const workspace = await resolveWorkspace(ctx, workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    // Mismo cálculo que la página de Cuentas (account_balances, SPEC 08c)
    const { data, error } = await ctx.supabase.rpc("account_balances", {
      p_workspace_id: workspace.id
    })
    if (error) {
      return toolError("No se pudieron cargar las cuentas.")
    }

    const accounts = data
      .filter((row) => include_archived || row.archived_at === null)
      .map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        balance: Number(row.balance),
        scheduled_balance: Number(row.scheduled_balance),
        archived: row.archived_at !== null,
        last_activity_on: row.last_activity_on
      }))

    return toolResult(
      `${accounts.length} ${accounts.length === 1 ? "cuenta" : "cuentas"} en ${workspace.name}.`,
      { workspace_id: workspace.id, accounts, currency: ctx.currency }
    )
  }
})
