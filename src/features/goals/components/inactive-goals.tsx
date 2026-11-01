"use client"

import { useState } from "react"
import { Button, Disclosure } from "@heroui/react"
import { formatCurrency } from "@/libs/format"
import type { Goal, GoalContribution } from "../queries"
import { GoalIcon } from "./goal-icon"
import { GoalStatusBadge } from "./goal-progress-bar"
import { GoalSheet } from "./goal-sheet"
import { useGoalAction } from "./use-goal-action"

interface InactiveGoalsProps {
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
  goals,
  contributions,
  today,
  currency
}: InactiveGoalsProps) {
  return (
    <Disclosure className="flex flex-col gap-3">
      <Disclosure.Heading>
        <Disclosure.Trigger className="flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-default">
          <Disclosure.Indicator />
          Cumplidas y archivadas ({goals.length})
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <ul className="divide-y rounded-xl border">
          {goals.map((goal) => (
            <InactiveGoalRow
              key={goal.id}
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
  goal,
  contributions,
  today,
  currency
}: {
  goal: Goal
  contributions: GoalContribution[]
  today: string
  currency: string
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const { pending, run } = useGoalAction(goal)

  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
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
            {formatCurrency(goal.saved, currency)} de{" "}
            {formatCurrency(goal.target_amount, currency)}
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
