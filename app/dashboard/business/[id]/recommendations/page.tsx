import { Suspense } from "react"
import { SITE } from "@/config/site"
import {
  BUSINESS_FACTOR_LABELS,
  BUSINESS_MONTH_FACTORS
} from "@/features/business-score/constants"
import { getBusinessScoreHistory } from "@/features/business-score/queries"
import { getBusinessRecommendations } from "@/features/business-score/recommendations"
import {
  ScoreRecommendationsSkeleton,
  ScoreRecommendationsView
} from "@/features/score/components/score-recommendations-view"
import { getDismissedRecommendations } from "@/features/score/queries"
import { splitDismissed } from "@/features/score/recommendation-helpers"
import { WorkspaceNoTransactions } from "@/features/transactions/components/workspace-no-transactions"
import { hasAnyTransactions } from "@/features/transactions/queries"
import { getWorkspace } from "@/features/workspaces/queries"
import { todayISO } from "@/libs/dates"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Recomendaciones",
  path: SITE.routes.dashboardBusiness,
  noindex: true
})

type BusinessRecommendationsPageProps =
  PageProps<"/dashboard/business/[id]/recommendations">

export default function BusinessRecommendationsPage({
  params
}: BusinessRecommendationsPageProps) {
  return (
    <section
      aria-label="Score y recomendaciones"
      className="flex flex-1 flex-col gap-6"
    >
      {/* params, la sesión y la fecha son dinámicos: van dentro de Suspense */}
      <Suspense fallback={<ScoreRecommendationsSkeleton />}>
        <RecommendationsContent params={params} />
      </Suspense>
    </section>
  )
}

// El layout ya validó que la empresa es del usuario y no está marcada
async function RecommendationsContent({
  params
}: Pick<BusinessRecommendationsPageProps, "params">) {
  const { id } = await params
  const workspace = await getWorkspace(id)

  if (!(await hasAnyTransactions(workspace.id))) {
    return (
      <WorkspaceNoTransactions
        workspaceId={workspace.id}
        workspaceType="business"
      />
    )
  }

  // Tras leer la sesión: todayISO usa new Date()
  const today = todayISO()
  const month = today.slice(0, 7)

  // Los descartes no dependen del score: se piden en paralelo
  const [{ inputs, history }, dismissed] = await Promise.all([
    getBusinessScoreHistory(workspace.id, today),
    getDismissedRecommendations(workspace.id, month)
  ])
  const recommendations = await getBusinessRecommendations(workspace, inputs)
  const { active, hidden } = splitDismissed(recommendations, dismissed)

  return (
    <ScoreRecommendationsView
      workspaceId={workspace.id}
      title="Salud del negocio"
      today={today}
      history={history}
      factorLabels={BUSINESS_FACTOR_LABELS}
      monthFactors={BUSINESS_MONTH_FACTORS}
      active={active}
      hidden={hidden}
    />
  )
}
