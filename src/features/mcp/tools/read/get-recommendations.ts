import { z } from "zod"
import { toolError, toolResult } from "../result"
import { defineTool, resolveWorkspace, workspaceIdSchema } from "../shared"
import { loadScore, toRecommendation, toScore } from "./get-score"

// Recomendaciones activas y desglose del score por factor (SPEC 43): las
// mismas del dashboard (score/recommendations.ts y business-score).

const input = z.object({ workspace_id: workspaceIdSchema })

export const getRecommendationsTool = defineTool({
  name: "get_recommendations",
  group: "read",
  title: "Recomendaciones",
  description:
    "Recomendaciones activas del espacio (las del dashboard, sin las que el usuario ocultó) con su severidad y evidencia, y el desglose del score del mes por factor: peso, valor y puntos de cada uno, o por qué se excluye. Sirve para explicar qué mejorar primero.",
  input,
  annotations: { readOnlyHint: true },
  async run(ctx, { workspace_id }) {
    const workspace = await resolveWorkspace(ctx, workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    const { month, history, active, labels } = await loadScore(ctx, workspace)
    const current = history.at(-1)
    const score = current ? toScore(current, labels) : null

    return toolResult(
      `${active.length} recomendaciones activas en ${workspace.name} (${month}).`,
      {
        workspace_id: workspace.id,
        workspace_type: workspace.type,
        month,
        recommendations: active.map(toRecommendation),
        score:
          score && "factors" in score
            ? { value: score.score, band_label: score.band_label }
            : null,
        factors: score && "factors" in score ? score.factors : [],
        insufficient:
          score && "insufficient" in score ? score.insufficient : null,
        currency: ctx.currency
      }
    )
  }
})
