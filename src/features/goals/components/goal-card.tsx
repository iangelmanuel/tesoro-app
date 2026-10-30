"use client"

import { useState } from "react"
import {
  Archive,
  CircleCheck,
  EllipsisVertical,
  PartyPopper,
  Pencil
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { formatCurrency } from "@/libs/format"
import { goalStatus, isReached } from "../progress"
import type { Goal, GoalContribution } from "../queries"
import { GoalDialog } from "./goal-dialog"
import { GoalIcon } from "./goal-icon"
import { GoalStatusBadge } from "./goal-progress-bar"
import { GoalSheet } from "./goal-sheet"
import { GoalSummary } from "./goal-summary"
import { useGoalAction } from "./use-goal-action"

interface GoalCardProps {
  goal: Goal
  contributions: GoalContribution[]
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  currency: string
}

export function GoalCard({
  goal,
  contributions,
  today,
  currency
}: GoalCardProps) {
  const [editing, setEditing] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const { pending, run } = useGoalAction(goal)

  return (
    <li className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        {/* Abre el Sheet con el detalle y los aportes */}
        <button
          type="button"
          className="-m-1 flex min-w-0 flex-1 items-start gap-3 rounded-lg p-1 text-left transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          onClick={() => setDetailOpen(true)}
        >
          <GoalIcon
            icon={goal.icon}
            color={goal.color}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium">{goal.name}</span>
              <GoalStatusBadge status={goalStatus(goal, today)} />
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">
              <span className="font-medium text-foreground">
                {formatCurrency(goal.saved, currency)}
              </span>{" "}
              de {formatCurrency(goal.target_amount, currency)}
            </span>
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Acciones de ${goal.name}`}
              disabled={pending}
            >
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => run("complete")}>
              <CircleCheck />
              Marcar como cumplida
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => run("archive")}>
              <Archive />
              Archivar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <GoalDialog
          goal={goal}
          open={editing}
          onOpenChange={setEditing}
        />
        <GoalSheet
          goal={goal}
          contributions={contributions}
          today={today}
          currency={currency}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      </div>

      <GoalSummary
        goal={goal}
        today={today}
        currency={currency}
      />

      {isReached(goal) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
            <PartyPopper className="size-4 shrink-0" />
            ¡Lo lograste!
          </p>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run("complete")}
          >
            Marcar como cumplida
          </Button>
        </div>
      )}
    </li>
  )
}
