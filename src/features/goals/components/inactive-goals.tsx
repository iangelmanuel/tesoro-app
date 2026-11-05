"use client"

import { useState } from "react"
import { Button, Disclosure } from "@heroui/react"
import { Amount } from "@/components/dashboard/amount"
import { SURFACE_LIST, SURFACE_ROW } from "@/components/dashboard/surface"
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
    <Disclosure className="flex flex-col gap-3">
      <Disclosure.Heading>
        <Disclosure.Trigger
          className="flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-default"
          data-tour="goals-inactive"
        >
          <Disclosure.Indicator />
          Cumplidas y archivadas ({goals.length})
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
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
      </Disclosure.Content>
    </Disclosure>
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
    <li className={`flex flex-wrap items-center gap-3 ${SURFACE_ROW}`}>
      {/* Abre el Sheet de solo lectura */}
      <button
        type="button"
        className="-m-1 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left transition-colors hover:bg-default/50 focus-visible:ring-[3px] focus-visible:ring-focus/50 focus-visible:outline-none"
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
          <span className="text-sm text-muted tabular-nums">
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
        variant="outline"
        size="sm"
        isDisabled={pending}
        onPress={() => run("reactivate")}
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
