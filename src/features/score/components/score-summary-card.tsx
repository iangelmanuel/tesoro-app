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
import { computeScore, hasScore, scoreVariation } from "../calculations"
import { SUMMARY_RECOMMENDATIONS } from "../constants"
import { getDismissedRecommendations, getScoreInputs } from "../queries"
import { getRecommendations, splitDismissed } from "../recommendations"
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

  const current = computeScore(inputs, month)
  const previous = computeScore(inputs, previousMonth)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salud financiera</CardTitle>
        <CardDescription>
          Tu score y lo más importante por hacer
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <Link href={RECOMMENDATIONS_PATH}>Ver todas</Link>
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
          recommendations={active.slice(0, SUMMARY_RECOMMENDATIONS)}
          compact
        />
      </CardContent>
    </Card>
  )
}
