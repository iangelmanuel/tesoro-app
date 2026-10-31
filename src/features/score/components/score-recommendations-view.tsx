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
import { hasScore, scoreVariation } from "../curves"
import type { Recommendation, ScoreResult } from "../types"
import { HiddenRecommendations } from "./hidden-recommendations"
import { RecommendationList } from "./recommendation-list"
import { ScoreFactors } from "./score-factors"
import { ScoreHistoryChart } from "./score-history-chart"
import { ScoreInsufficient } from "./score-insufficient"
import { ScoreOverview } from "./score-overview"

interface ScoreRecommendationsViewProps<K extends string> {
  workspaceId: string
  /** "Salud financiera" o "Salud del negocio" */
  title: string
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  /** Score de los 12 meses hasta el actual */
  history: ScoreResult<K>[]
  factorLabels: Record<K, string>
  monthFactors: readonly K[]
  /** Recomendaciones activas, ya ordenadas */
  active: Recommendation<string>[]
  /** Recomendaciones ocultas este mes */
  hidden: Recommendation<string>[]
}

/** Score, desglose, histórico, recomendaciones y ocultas de un espacio */
export function ScoreRecommendationsView<K extends string>({
  workspaceId,
  title,
  today,
  history,
  factorLabels,
  monthFactors,
  active,
  hidden
}: ScoreRecommendationsViewProps<K>) {
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
            <CardTitle>{title}</CardTitle>
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
              <ScoreFactors
                factors={current.factors}
                labels={factorLabels}
                monthFactors={monthFactors}
              />
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
            workspaceId={workspaceId}
            recommendations={active}
          />
        </CardContent>
      </Card>

      {hidden.length > 0 && (
        <HiddenRecommendations
          workspaceId={workspaceId}
          recommendations={hidden}
        />
      )}
    </>
  )
}

export function ScoreRecommendationsSkeleton() {
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
