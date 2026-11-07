import { z } from "zod"
import { getGoals } from "@/features/goals/queries"
import { toolError, toolResult } from "../result"
import {
  PERSONAL_ONLY,
  defineTool,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"

const input = z.object({
  workspace_id: workspaceIdSchema,
  include_inactive: z
    .boolean()
    .default(false)
    .describe("Incluir metas completadas o archivadas.")
})

export const listGoals = defineTool({
  name: "list_goals",
  group: "read",
  title: "Listar metas",
  description:
    "Metas de ahorro con su progreso, como la página de Metas: objetivo, ahorrado, lo que falta, porcentaje, fecha objetivo y estado. Solo Personal.",
  input,
  annotations: { readOnlyHint: true },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }
    if (workspace.type !== "personal") {
      return toolError(PERSONAL_ONLY)
    }

    const goals = (await getGoals(workspace.id))
      .filter((goal) => args.include_inactive || goal.status === "active")
      .map((goal) => ({
        id: goal.id,
        name: goal.name,
        status: goal.status,
        target_amount: goal.target_amount,
        saved: goal.saved,
        remaining: Math.max(
          0,
          Math.round((goal.target_amount - goal.saved) * 100) / 100
        ),
        progress_percent:
          goal.target_amount === 0
            ? null
            : Math.round((goal.saved / goal.target_amount) * 1000) / 10,
        target_date: goal.target_date ?? null,
        completed_at: goal.completed_at ?? null
      }))

    return toolResult(`${goals.length} metas en ${workspace.name}.`, {
      workspace_id: workspace.id,
      goals,
      currency: ctx.currency
    })
  }
})
