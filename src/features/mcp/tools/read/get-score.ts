import { z } from "zod"
import { BUSINESS_FACTOR_LABELS } from "@/features/business-score/constants"
import { getBusinessScoreHistory } from "@/features/business-score/queries"
import { getBusinessRecommendations } from "@/features/business-score/recommendations"
import {
  BANDS,
  FACTOR_LABELS,
  SEVERITY_LABELS
} from "@/features/score/constants"
import {
  getDismissedRecommendations,
  getScoreHistory
} from "@/features/score/queries"
import {
  getRecommendations,
  splitDismissed
} from "@/features/score/recommendations"
import type {
  FactorResult,
  Recommendation,
  ScoreResult
} from "@/features/score/types"
import { todayISO } from "@/libs/dates"
import { toolError, toolResult } from "../result"
import { defineTool, resolveWorkspace, workspaceIdSchema } from "../shared"

const input = z.object({ workspace_id: workspaceIdSchema })

function toFactor(
  factor: FactorResult<string>,
  labels: Record<string, string>
) {
  const base = {
    key: factor.key,
    label: labels[factor.key] ?? factor.key,
    weight: factor.weight
  }
  return "excluded" in factor
    ? { ...base, excluded: factor.excluded }
    : { ...base, value: factor.value, points: Math.round(factor.points) }
}

function toScore(result: ScoreResult<string>, labels: Record<string, string>) {
  if ("insufficient" in result) {
    return {
      month: result.month,
      score: null,
      insufficient: result.insufficient
    }
  }
  return {
    month: result.month,
    score: Math.round(result.score),
    band: result.band,
    band_label: BANDS.find((band) => band.band === result.band)?.label,
    factors: result.factors.map((factor) => toFactor(factor, labels))
  }
}

function toRecommendation(item: Recommendation<string>) {
  return {
    rule: item.rule,
    severity: item.severity,
    severity_label: SEVERITY_LABELS[item.severity],
    title: item.title,
    evidence: item.evidence
  }
}

export const getScore = defineTool({
  name: "get_score",
  group: "read",
  title: "Score de salud",
  description:
    "Score de salud financiera del espacio (0–100) del mes actual con su banda y factores, la historia de 12 meses y las recomendaciones activas (sin las que el usuario ocultó). Personal usa los factores de salud financiera; Empresa, los de salud del negocio.",
  input,
  annotations: { readOnlyHint: true },
  async run(ctx, { workspace_id }) {
    const workspace = await resolveWorkspace(ctx, workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    const today = todayISO()
    const month = today.slice(0, 7)

    // Mismo cálculo que las páginas de Recomendaciones (SPEC 07 y 11)
    let history: ScoreResult<string>[]
    let recommendations: Recommendation<string>[]
    let labels: Record<string, string>

    if (workspace.type === "business") {
      const score = await getBusinessScoreHistory(workspace.id, today)
      history = score.history
      recommendations = await getBusinessRecommendations(
        { id: workspace.id, type: workspace.type, currency: ctx.currency },
        score.inputs
      )
      labels = BUSINESS_FACTOR_LABELS
    } else {
      const score = await getScoreHistory(workspace.id, today)
      history = score.history
      recommendations = await getRecommendations(workspace.id, score.inputs)
      labels = FACTOR_LABELS
    }

    const dismissed = await getDismissedRecommendations(workspace.id, month)
    const { active } = splitDismissed(recommendations, dismissed)
    const current = history.at(-1)
    const currentScore = current ? toScore(current, labels) : null

    return toolResult(
      currentScore?.score != null
        ? `Score de ${workspace.name} en ${month}: ${currentScore.score} (${currentScore.band_label}). ${active.length} recomendaciones activas.`
        : `Aún no hay datos suficientes para el score de ${workspace.name}. ${active.length} recomendaciones activas.`,
      {
        workspace_id: workspace.id,
        workspace_type: workspace.type,
        current: currentScore,
        history: history.map((row) =>
          "insufficient" in row
            ? { month: row.month, score: null }
            : { month: row.month, score: Math.round(row.score) }
        ),
        recommendations: active.map(toRecommendation),
        currency: ctx.currency
      }
    )
  }
})
