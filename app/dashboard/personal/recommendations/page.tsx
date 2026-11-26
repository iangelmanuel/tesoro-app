import { Suspense } from "react"
import { SITE } from "@/config/site"
import {
  ScoreRecommendationsSkeleton,
  ScoreRecommendationsView
} from "@/features/score/components/score-recommendations-view"
import { FACTOR_LABELS, MONTH_FACTORS } from "@/features/score/constants"
import {
  getDismissedRecommendations,
  getScoreHistory
} from "@/features/score/queries"
import { splitDismissed } from "@/features/score/recommendation-helpers"
import {
  loadRecommendationData,
  recommendationsFor
} from "@/features/score/recommendations"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { todayISO } from "@/libs/dates"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Recomendaciones",
  path: `${SITE.routes.dashboardPersonal}/recommendations`,
  noindex: true
})

export default function RecommendationsPage() {
  return (
    <section
      aria-label="Score y recomendaciones"
      className="flex flex-1 flex-col gap-6"
    >
      {/* La sesión y la fecha son dinámicas: van dentro de Suspense */}
      <Suspense fallback={<ScoreRecommendationsSkeleton />}>
        <RecommendationsContent />
      </Suspense>
    </section>
  )
}

async function RecommendationsContent() {
  const workspace = await getPersonalWorkspace()
  // Tras leer la sesión: todayISO usa new Date()
  const today = todayISO()
  const month = today.slice(0, 7)

  // Score, datos de las reglas y descartes no dependen entre sí: en paralelo
  const [{ inputs, history }, data, dismissed] = await Promise.all([
    getScoreHistory(workspace.id, today),
    loadRecommendationData(workspace.id, today),
    getDismissedRecommendations(workspace.id, month)
  ])
  const recommendations = recommendationsFor(inputs, data)
  const { active, hidden } = splitDismissed(recommendations, dismissed)

  return (
    <ScoreRecommendationsView
      workspaceId={workspace.id}
      title="Salud financiera"
      today={today}
      history={history}
      factorLabels={FACTOR_LABELS}
      monthFactors={MONTH_FACTORS}
      active={active}
      hidden={hidden}
    />
  )
}
