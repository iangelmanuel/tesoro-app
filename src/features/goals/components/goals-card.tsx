import Link from "next/link"
import { Card, CardContent, buttonVariants } from "@heroui/react"
import { Target } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { CardHeading } from "@/components/dashboard/card-heading"
import { CardEmpty } from "@/components/dashboard/empty-state"
import { formatPercent } from "@/features/budgets/progress"
import { todayISO } from "@/libs/dates"
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
      <CardHeading
        title="Metas de ahorro"
        href={GOALS_PATH}
        linkLabel="Ver todas"
        linkContext="las metas"
      />
      <CardContent>
        {active.length === 0 && (
          <CardEmpty
            icon={Target}
            message="No tienes metas activas"
            hint="Ponle nombre y monto a lo que quieres ahorrar."
            action={
              <Link
                href={GOALS_PATH}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Crear meta
              </Link>
            }
          />
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
                  <p className="min-w-0 truncate font-medium">{goal.name}</p>
                  <GoalStatusBadge status={status} />
                  <p className="ml-auto shrink-0 text-sm font-medium whitespace-nowrap tabular-nums">
                    {formatPercent(percent)}
                  </p>
                </div>
                <GoalProgressBar
                  percent={percent}
                  status={status}
                  label={`${goal.name}: ${formatPercent(percent)}`}
                />
                <p className="text-sm text-muted tabular-nums">
                  <Amount
                    value={goal.saved}
                    currency={currency}
                  />{" "}
                  de{" "}
                  <Amount
                    value={goal.target_amount}
                    currency={currency}
                  />
                </p>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
