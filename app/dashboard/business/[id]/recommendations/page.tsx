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
import { splitDismissed } from "@/features/score/recommendations"
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
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Score y recomendaciones
        </h1>
        <p className="text-sm text-muted-foreground">
          La salud de tu negocio de 0 a 100 y qué hacer para mejorarla.
        </p>
      </header>
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

  const { inputs, history } = await getBusinessScoreHistory(workspace.id, today)
  const [recommendations, dismissed] = await Promise.all([
    getBusinessRecommendations(workspace, inputs),
    getDismissedRecommendations(workspace.id, month)
  ])
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
