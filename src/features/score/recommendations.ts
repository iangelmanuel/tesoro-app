import "server-only"
// Recomendaciones de Personal (SPEC 07): consulta lo que piden las reglas de
// recommendation-rules.ts y las evalúa.
import { getAccountBalances } from "@/features/accounts/queries"
import { getBudgetProgress } from "@/features/budgets/queries"
import { getUpcomingPayments } from "@/features/recurring-expenses/queries"
import { getCategoryTotals } from "@/features/reports/queries"
import type { ScoreData } from "./queries"
import {
  buildRecommendations,
  categoryGrowthRanges
} from "./recommendation-rules"

/** Datos que piden las reglas, aparte del score */
export type RecommendationData = Omit<
  Parameters<typeof buildRecommendations>[0],
  "score"
>

/**
 * Consulta lo que piden las reglas del mes de `today`. No depende del score:
 * las pantallas lo piden en paralelo con él (SPEC 56a) y luego evalúan con
 * `recommendationsFor`
 */
export async function loadRecommendationData(
  workspaceId: string,
  today: string
): Promise<RecommendationData> {
  const month = today.slice(0, 7)
  const { last, base } = categoryGrowthRanges(month)

  const [
    lastClosedCategories,
    baseCategories,
    budgets,
    upcomingPayments,
    accounts
  ] = await Promise.all([
    getCategoryTotals(workspaceId, last.from, last.to, "expense"),
    getCategoryTotals(workspaceId, base.from, base.to, "expense"),
    getBudgetProgress(workspaceId, month),
    getUpcomingPayments(workspaceId),
    getAccountBalances(workspaceId)
  ])

  return {
    lastClosedCategories,
    baseCategories,
    budgets,
    upcomingPayments,
    accounts
  }
}

/** Evalúa las reglas con el score y los datos ya cargados */
export function recommendationsFor(score: ScoreData, data: RecommendationData) {
  return buildRecommendations({ score, ...data })
}

/** Consulta lo que falta para las reglas del mes actual y las evalúa */
export async function getRecommendations(
  workspaceId: string,
  score: ScoreData
) {
  return recommendationsFor(
    score,
    await loadRecommendationData(workspaceId, score.today)
  )
}
