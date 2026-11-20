"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { SURFACE_LIST, SURFACE_ROW } from "@/components/dashboard/surface"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible"
import { cn } from "@/libs/cn"
import type { Goal, GoalContribution } from "../queries"
import { GoalIcon } from "./goal-icon"
import { GoalStatusBadge } from "./goal-progress-bar"
import { GoalSheet } from "./goal-sheet"
import { useGoalAction } from "./use-goal-action"

interface InactiveGoalsProps {
  workspaceId: string
  /** Metas cumplidas y archivadas */
  goals: Goal[]
  /** Aportes por id de meta */
  contributions: Record<string, GoalContribution[]>
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  currency: string
}

/** Sección plegable "Cumplidas y archivadas", cerrada por defecto */
export function InactiveGoals({
  workspaceId,
  goals,
  contributions,
  today,
  currency
}: InactiveGoalsProps) {
  return (
    <Collapsible className="flex flex-col gap-3">
      <h2 className="w-fit">
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              className="group/inactive px-3"
            />
          }
          data-tour="goals-inactive"
        >
          <ChevronRight
            aria-hidden
            className="group-data-panel-open/inactive:rotate-90 motion-safe:transition-transform"
          />
          Cumplidas y archivadas ({goals.length})
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent>
        <ul className={SURFACE_LIST}>
          {goals.map((goal) => (
            <InactiveGoalRow
              key={goal.id}
              workspaceId={workspaceId}
              goal={goal}
              contributions={contributions[goal.id] ?? []}
              today={today}
              currency={currency}
            />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

function InactiveGoalRow({
  workspaceId,
  goal,
  contributions,
  today,
  currency
}: {
  workspaceId: string
  goal: Goal
  contributions: GoalContribution[]
  today: string
  currency: string
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const { pending, run } = useGoalAction(goal)

  return (
    <li className={cn(SURFACE_ROW, "flex flex-wrap items-center gap-3")}>
      {/* Abre el Sheet de solo lectura */}
      <button
        type="button"
        className="-m-1 flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-2xl p-1 text-left transition-colors outline-none hover:bg-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onClick={() => setDetailOpen(true)}
      >
        <GoalIcon
          icon={goal.icon}
          color={goal.color}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{goal.name}</span>
            <GoalStatusBadge
              status={goal.status === "active" ? null : goal.status}
            />
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">
            <Amount
              value={goal.saved}
              currency={currency}
            />{" "}
            de{" "}
            <Amount
              value={goal.target_amount}
              currency={currency}
            />
          </span>
        </span>
      </button>
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => run("reactivate")}
      >
        Reactivar
      </Button>
      <GoalSheet
        workspaceId={workspaceId}
        goal={goal}
        contributions={contributions}
        today={today}
        currency={currency}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </li>
  )
}
