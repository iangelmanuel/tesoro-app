import Link from "next/link"
import { Target } from "lucide-react"
import { CardEmpty } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { formatPercent } from "@/features/budgets/progress"
import { todayISO } from "@/libs/dates"
import { formatCurrency } from "@/libs/format"
import {
  GOALS_PATH,
  compareByTargetDate,
  goalPercent,
  goalStatus
} from "../progress"
import { getGoals } from "../queries"
import { GoalIcon } from "./goal-icon"
import { GoalProgressBar, GoalStatusBadge } from "./goal-progress-bar"

const MAX_GOALS = 3

interface GoalsCardProps {
  workspaceId: string
  currency: string
}

// Hasta 3 metas activas, de fecha objetivo más cercana primero
export async function GoalsCard({ workspaceId, currency }: GoalsCardProps) {
  const goals = await getGoals(workspaceId)
  const today = todayISO()
  const active = goals
    .filter((goal) => goal.status === "active")
    .sort(compareByTargetDate)
    .slice(0, MAX_GOALS)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metas de ahorro</CardTitle>
        <CardDescription>Las de fecha más cercana</CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <Link href={GOALS_PATH}>Ver todas</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {active.length === 0 && (
          <div className="flex flex-col items-center gap-3">
            <CardEmpty
              icon={Target}
              message="No tienes metas activas"
            />
            <Button
              variant="link"
              size="sm"
              asChild
            >
              <Link href={GOALS_PATH}>Crear meta</Link>
            </Button>
          </div>
        )}
        <ul className="flex flex-col divide-y">
          {active.map((goal) => {
            const percent = goalPercent(goal.saved, goal.target_amount)
            const status = goalStatus(goal, today)
            return (
              <li
                key={goal.id}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <GoalIcon
                    icon={goal.icon}
                    color={goal.color}
                    className="size-7"
                  />
                  <p className="truncate font-medium">{goal.name}</p>
                  <GoalStatusBadge status={status} />
                  <p className="ml-auto text-sm font-medium tabular-nums">
                    {formatPercent(percent)}
                  </p>
                </div>
                <GoalProgressBar
                  percent={percent}
                  status={status}
                />
                <p className="text-sm text-muted-foreground tabular-nums">
                  {formatCurrency(goal.saved, currency)} de{" "}
                  {formatCurrency(goal.target_amount, currency)}
                </p>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
