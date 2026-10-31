import { Suspense } from "react"
import { ChartLine } from "lucide-react"
import { CardEmpty } from "@/components/dashboard/empty-state"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SITE } from "@/config/site"
import { HiddenRecommendations } from "@/features/score/components/hidden-recommendations"
import { RecommendationList } from "@/features/score/components/recommendation-list"
import { ScoreFactors } from "@/features/score/components/score-factors"
import { ScoreHistoryChart } from "@/features/score/components/score-history-chart"
import { ScoreInsufficient } from "@/features/score/components/score-insufficient"
import { ScoreOverview } from "@/features/score/components/score-overview"
import { hasScore, scoreVariation } from "@/features/score/curves"
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
      <Suspense fallback={<RecommendationsSkeleton />}>
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

  const current = history[history.length - 1]
  const previous = history[history.length - 2]
  const points = history.map((result) => ({
    month: result.month,
    score: hasScore(result) ? result.score : null
  }))

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Salud financiera</CardTitle>
            <CardDescription>Score del mes actual</CardDescription>
          </CardHeader>
          <CardContent>
            {hasScore(current) ? (
              <ScoreOverview
                score={current.score}
                band={current.band}
                variation={scoreVariation(current, previous)}
                today={today}
              />
            ) : (
              <ScoreInsufficient reasons={current.insufficient} />
            )}
          </CardContent>
        </Card>
        {hasScore(current) && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Desglose</CardTitle>
              <CardDescription>
                Un factor sin datos se excluye y los pesos de los demás se
                reescalan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScoreFactors factors={current.factors} />
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolución</CardTitle>
          <CardDescription>Últimos 12 meses</CardDescription>
        </CardHeader>
        <CardContent>
          {points.every((point) => point.score === null) ? (
            <CardEmpty
              icon={ChartLine}
              message="Aún no hay histórico"
            />
          ) : (
            <ScoreHistoryChart data={points} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recomendaciones</CardTitle>
          <CardDescription>
            Ordenadas por severidad. Cada una dice en qué dato se basa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecommendationList
            workspaceId={workspace.id}
            recommendations={active}
          />
        </CardContent>
      </Card>

      {hidden.length > 0 && (
        <HiddenRecommendations
          workspaceId={workspace.id}
          recommendations={hidden}
        />
      )}
    </>
  )
}

function RecommendationsSkeleton() {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48 lg:col-span-2" />
      </div>
      <Skeleton className="h-80" />
      <Skeleton className="h-64" />
    </>
  )
}
