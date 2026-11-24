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

/** Consulta lo que falta para las reglas del mes actual y las evalúa */
export async function getRecommendations(
  workspaceId: string,
  score: ScoreData
) {
  const month = score.today.slice(0, 7)
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

  return buildRecommendations({
    score,
    lastClosedCategories,
    baseCategories,
    budgets,
    upcomingPayments,
    accounts
  })
}
