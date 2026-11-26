import { ChartLine } from "lucide-react"
import {
  CardHeading,
  CardHeadingSkeleton
} from "@/components/dashboard/data/card-heading"
import { CARD } from "@/components/dashboard/data/surface"
import { CardEmpty } from "@/components/dashboard/feedback/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/libs/cn"
import { hasScore, scoreVariation } from "../curves"
import type { Recommendation, ScoreResult } from "../types"
import { HiddenRecommendations } from "./hidden-recommendations"
import {
  RecommendationList,
  RecommendationListSkeleton
} from "./recommendation-list"
import { ScoreFactors, ScoreFactorsSkeleton } from "./score-factors"
import {
  ScoreHistoryChartLazy,
  ScoreHistoryChartSkeleton
} from "./score-history-chart-lazy"
import { ScoreInsufficient } from "./score-insufficient"
import { ScoreOverview, ScoreOverviewSkeleton } from "./score-overview"

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
        <ScoreCard
          data-tour="recommendations-score"
          title={title}
          description="Score del mes actual"
        >
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
        </ScoreCard>
        {hasScore(current) && (
          <ScoreCard
            className="lg:col-span-2"
            data-tour="recommendations-factors"
            title="Desglose"
            description="Un factor sin datos se excluye y los pesos de los demás se reescalan"
          >
            <ScoreFactors
              factors={current.factors}
              labels={factorLabels}
              monthFactors={monthFactors}
            />
          </ScoreCard>
        )}
      </div>

      <ScoreCard
        data-tour="recommendations-history"
        title="Evolución"
        description="Últimos 12 meses"
      >
        {points.every((point) => point.score === null) ? (
          <CardEmpty
            icon={ChartLine}
            message="Aún no hay histórico"
          />
        ) : (
          <ScoreHistoryChartLazy data={points} />
        )}
      </ScoreCard>

      <ScoreCard
        data-tour="recommendations-list"
        title="Recomendaciones"
        description="Ordenadas por severidad. Cada una dice en qué dato se basa"
      >
        <RecommendationList
          workspaceId={workspaceId}
          recommendations={active}
        />
      </ScoreCard>

      {hidden.length > 0 && (
        <HiddenRecommendations
          workspaceId={workspaceId}
          recommendations={hidden}
        />
      )}
    </>
  )
}

/** Tarjeta de la pantalla: título (h2), descripción y contenido */
function ScoreCard({
  title,
  description,
  className,
  children,
  "data-tour": dataTour
}: {
  title: string
  description: string
  className?: string
  children: React.ReactNode
  "data-tour"?: string
}) {
  return (
    <section
      className={cn(CARD, className)}
      data-tour={dataTour}
    >
      <div className="flex flex-col gap-1">
        <CardHeading title={title} />
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

/** Hueco de ScoreCard: cabecera, descripción y el hueco del contenido */
function ScoreCardSkeleton({
  className,
  children
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(CARD, className)}
    >
      <div className="flex flex-col gap-1">
        <CardHeadingSkeleton />
        <Skeleton className="h-4 w-56" />
      </div>
      {children}
    </div>
  )
}

/** Hueco de la pantalla: score, desglose, evolución y recomendaciones */
export function ScoreRecommendationsSkeleton() {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <ScoreCardSkeleton>
          <ScoreOverviewSkeleton />
        </ScoreCardSkeleton>
        <ScoreCardSkeleton className="lg:col-span-2">
          <ScoreFactorsSkeleton />
        </ScoreCardSkeleton>
      </div>
      <ScoreCardSkeleton>
        <ScoreHistoryChartSkeleton />
      </ScoreCardSkeleton>
      <ScoreCardSkeleton>
        <RecommendationListSkeleton />
      </ScoreCardSkeleton>
    </>
  )
}
