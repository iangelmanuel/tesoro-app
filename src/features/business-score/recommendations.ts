import "server-only"
// Recomendaciones de Empresa (SPEC 11): consulta lo que piden las reglas de
// recommendation-rules.ts y las evalúa.
import { getAccountBalances } from "@/features/accounts/queries"
import { windowMonths } from "@/features/score/curves"
import { getTransactionTotals } from "@/features/transactions/queries"
import { monthRange } from "@/libs/dates"
import { getCounterpartyTotals } from "./queries"
import {
  type RuleWorkspace,
  buildBusinessRecommendations
} from "./recommendation-rules"
import type { BusinessScoreInputs } from "./types"

/** Consulta lo que falta para las reglas del mes actual y las evalúa */
export async function getBusinessRecommendations(
  workspace: RuleWorkspace,
  score: BusinessScoreInputs
) {
  const month = score.today.slice(0, 7)
  const range = monthRange(month)
  const window = windowMonths(month, score.firstTransactionOn)
  const windowFrom = window.length > 0 ? `${window[0]}-01` : range.from

  const [accounts, salesByClient, monthTotals, withoutAccountTotals] =
    await Promise.all([
      getAccountBalances(workspace.id),
      getCounterpartyTotals(workspace.id, windowFrom, range.to, "income"),
      getTransactionTotals(workspace.id, { month, page: 1 }),
      getTransactionTotals(workspace.id, {
        month,
        accountId: "none",
        page: 1
      })
    ])

  return buildBusinessRecommendations({
    workspace,
    score,
    accounts,
    salesByClient,
    monthTotals,
    withoutAccountTotals
  })
}
