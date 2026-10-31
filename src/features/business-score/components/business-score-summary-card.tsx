import { ScoreSummary } from "@/features/score/components/score-summary-card"
import { getDismissedRecommendations } from "@/features/score/queries"
import { splitDismissed } from "@/features/score/recommendations"
import { workspaceRecommendationsPath } from "@/features/workspaces/paths"
import type { Workspace } from "@/features/workspaces/queries"
import { shiftMonth, todayISO } from "@/libs/dates"
import { computeBusinessScore } from "../calculations"
import { getBusinessScoreInputs } from "../queries"
import { getBusinessRecommendations } from "../recommendations"

// "Salud del negocio": score del mes actual, variación y las 3
// recomendaciones principales no ocultas
export async function BusinessScoreSummaryCard({
  workspace
}: {
  workspace: Pick<Workspace, "id" | "type" | "currency">
}) {
  const today = todayISO()
  const month = today.slice(0, 7)
  const previousMonth = shiftMonth(month, -1)

  // Solo el mes actual y el anterior: basta para la variación y las reglas
  const inputs = await getBusinessScoreInputs(
    workspace.id,
    previousMonth,
    month,
    today
  )
  const [recommendations, dismissed] = await Promise.all([
    getBusinessRecommendations(workspace, inputs),
    getDismissedRecommendations(workspace.id, month)
  ])
  const { active } = splitDismissed(recommendations, dismissed)

  return (
    <ScoreSummary
      workspaceId={workspace.id}
      title="Salud del negocio"
      description="El score de tu empresa y lo más importante por hacer"
      href={workspaceRecommendationsPath(workspace)}
      current={computeBusinessScore(inputs, month)}
      previous={computeBusinessScore(inputs, previousMonth)}
      recommendations={active}
    />
  )
}
