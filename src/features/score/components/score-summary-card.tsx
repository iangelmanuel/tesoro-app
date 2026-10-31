import type { Route } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { SITE } from "@/config/site"
import { shiftMonth, todayISO } from "@/libs/dates"
import { computeScore } from "../calculations"
import { SUMMARY_RECOMMENDATIONS } from "../constants"
import { hasScore, scoreVariation } from "../curves"
import { getDismissedRecommendations, getScoreInputs } from "../queries"
import { getRecommendations, splitDismissed } from "../recommendations"
import type { Recommendation, ScoreResult } from "../types"
import { RecommendationList } from "./recommendation-list"
import { ScoreInsufficient } from "./score-insufficient"
import { BandBadge, ScoreVariation } from "./score-overview"

const RECOMMENDATIONS_PATH =
  `${SITE.routes.dashboardPersonal}/recommendations` as const

// "Salud financiera": score del mes actual, variación y las 3
// recomendaciones principales no ocultas
export async function ScoreSummaryCard({
  workspaceId
}: {
  workspaceId: string
}) {
  const today = todayISO()
  const month = today.slice(0, 7)
  const previousMonth = shiftMonth(month, -1)

  // Solo el mes actual y el anterior: basta para la variación y las reglas
  const inputs = await getScoreInputs(workspaceId, previousMonth, month, today)
  const [recommendations, dismissed] = await Promise.all([
    getRecommendations(workspaceId, inputs),
    getDismissedRecommendations(workspaceId, month)
  ])
  const { active } = splitDismissed(recommendations, dismissed)

  return (
    <ScoreSummary
      workspaceId={workspaceId}
      title="Salud financiera"
      description="Tu score y lo más importante por hacer"
      href={RECOMMENDATIONS_PATH}
      current={computeScore(inputs, month)}
      previous={computeScore(inputs, previousMonth)}
      recommendations={active}
    />
  )
}

interface ScoreSummaryProps<K extends string> {
  workspaceId: string
  title: string
  description: string
  /** Página de Recomendaciones del espacio */
  href: string
  current: ScoreResult<K>
  previous: ScoreResult<K>
  /** Recomendaciones activas, ya ordenadas; se muestran las 3 primeras */
  recommendations: Recommendation<string>[]
}

/** Tarjeta del Resumen de cualquier espacio, con los datos ya calculados */
export function ScoreSummary<K extends string>({
  workspaceId,
  title,
  description,
  href,
  current,
  previous,
  recommendations
}: ScoreSummaryProps<K>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <Link href={href as Route}>Ver todas</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[minmax(0,14rem)_1fr]">
        {hasScore(current) ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <span className="text-4xl font-semibold tracking-tight tabular-nums">
                {current.score}
              </span>
              <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
            </div>
            <BandBadge band={current.band} />
            <ScoreVariation variation={scoreVariation(current, previous)} />
          </div>
        ) : (
          <ScoreInsufficient reasons={current.insufficient} />
        )}
        <RecommendationList
          workspaceId={workspaceId}
          recommendations={recommendations.slice(0, SUMMARY_RECOMMENDATIONS)}
          compact
        />
      </CardContent>
    </Card>
  )
}
