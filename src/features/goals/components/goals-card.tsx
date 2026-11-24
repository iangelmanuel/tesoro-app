import Link from "next/link"
import { Target } from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import {
  CardHeading,
  CardHeadingSkeleton
} from "@/components/dashboard/data/card-heading"
import { CARD, CARD_LIST, CARD_ROW } from "@/components/dashboard/data/surface"
import { CardEmpty } from "@/components/dashboard/feedback/empty-state"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/libs/cn"
import { todayISO } from "@/libs/dates"
import { formatPercentLabel } from "@/libs/format"
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
    <section
      aria-label="Metas de ahorro"
      className={CARD}
    >
      <CardHeading
        title="Metas de ahorro"
        href={GOALS_PATH}
        linkLabel="Ver todas"
        linkContext="las metas"
      />
      <div>
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
        <ul className={CARD_LIST}>
          {active.map((goal) => {
            const percent = goalPercent(goal.saved, goal.target_amount)
            const status = goalStatus(goal, today)
            return (
              <li
                key={goal.id}
                className={cn("flex flex-col gap-2", CARD_ROW)}
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
                    {formatPercentLabel(percent)}
                  </p>
                </div>
                <GoalProgressBar
                  percent={percent}
                  status={status}
                  label={`${goal.name}: ${formatPercentLabel(percent)}`}
                />
                <p className="text-sm text-muted-foreground tabular-nums">
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
      </div>
    </section>
  )
}

/** Metas mientras carga: tres filas con su barra */
export function GoalsCardSkeleton() {
  return (
    <div className={CARD}>
      <CardHeadingSkeleton />
      <ul className={CARD_LIST}>
        {Array.from({ length: 3 }, (_, index) => (
          <li
            key={index}
            className={cn("flex flex-col gap-2", CARD_ROW)}
          >
            <div className="flex items-center gap-2">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="ml-auto h-5 w-12" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-5 w-40" />
          </li>
        ))}
      </ul>
    </div>
  )
}
