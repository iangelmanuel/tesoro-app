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
import {
  getRecommendations,
  splitDismissed
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
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Score y recomendaciones
        </h1>
        <p className="text-sm text-muted-foreground">
          Tu salud financiera de 0 a 100 y qué hacer para mejorarla.
        </p>
      </header>
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

  const { inputs, history } = await getScoreHistory(workspace.id, today)
  const [recommendations, dismissed] = await Promise.all([
    getRecommendations(workspace.id, inputs),
    getDismissedRecommendations(workspace.id, month)
  ])
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
