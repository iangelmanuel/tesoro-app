import { Card, CardContent } from "@heroui/react"
import { CardHeading } from "@/components/dashboard/card-heading"
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
      layout="side"
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
  /**
   * "wide": score y recomendaciones lado a lado. "side": apilados, para la
   * columna lateral del Resumen
   */
  layout?: "wide" | "side"
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
  layout = "wide",
  href,
  current,
  previous,
  recommendations
}: ScoreSummaryProps<K>) {
  return (
    <Card>
      <CardHeading
        title={title}
        help="score"
        href={href}
        linkLabel="Ver todas"
        linkContext="las recomendaciones"
      />
      <CardContent
        className={
          layout === "side"
            ? "flex flex-col gap-5"
            : "grid gap-6 md:grid-cols-[minmax(0,14rem)_1fr]"
        }
      >
        {hasScore(current) ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <p className="flex items-end gap-1.5">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">
                  {current.score}
                </span>
                <span className="pb-1 text-sm text-muted">/ 100</span>
              </p>
              <span className="pb-1.5">
                <BandBadge band={current.band} />
              </span>
            </div>
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
