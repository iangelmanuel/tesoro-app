"use client"

import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible"
import { formatCurrency } from "@/libs/format"
import type { Goal } from "../queries"
import { GoalIcon } from "./goal-icon"
import { GoalStatusBadge } from "./goal-progress-bar"
import { useGoalAction } from "./use-goal-action"

interface InactiveGoalsProps {
  /** Metas cumplidas y archivadas */
  goals: Goal[]
  currency: string
}

/** Sección plegable "Cumplidas y archivadas", cerrada por defecto */
export function InactiveGoals({ goals, currency }: InactiveGoalsProps) {
  return (
    <Collapsible className="flex flex-col gap-3">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="group w-fit"
        >
          <ChevronDown
            data-icon="inline-start"
            className="transition-transform group-data-[state=closed]:-rotate-90"
          />
          Cumplidas y archivadas ({goals.length})
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="divide-y rounded-xl border">
          {goals.map((goal) => (
            <InactiveGoalRow
              key={goal.id}
              goal={goal}
              currency={currency}
            />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

function InactiveGoalRow({ goal, currency }: { goal: Goal; currency: string }) {
  const { pending, run } = useGoalAction(goal)

  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <GoalIcon
        icon={goal.icon}
        color={goal.color}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{goal.name}</p>
          <GoalStatusBadge
            status={goal.status === "active" ? null : goal.status}
          />
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {formatCurrency(goal.saved, currency)} de{" "}
          {formatCurrency(goal.target_amount, currency)}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run("reactivate")}
      >
        Reactivar
      </Button>
    </li>
  )
}
