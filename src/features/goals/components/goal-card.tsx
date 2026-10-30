"use client"

import { useState } from "react"
import {
  Archive,
  CircleCheck,
  EllipsisVertical,
  PartyPopper,
  Pencil,
  TriangleAlert
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { formatPercent } from "@/features/budgets/progress"
import { formatCurrency, formatDate } from "@/libs/format"
import {
  goalPercent,
  goalRemaining,
  goalStatus,
  isOverdue,
  isReached,
  suggestedMonthly
} from "../progress"
import type { Goal } from "../queries"
import { GoalDialog } from "./goal-dialog"
import { GoalIcon } from "./goal-icon"
import { GoalProgressBar, GoalStatusBadge } from "./goal-progress-bar"
import { useGoalAction } from "./use-goal-action"

interface GoalCardProps {
  goal: Goal
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  currency: string
}

export function GoalCard({ goal, today, currency }: GoalCardProps) {
  const [editing, setEditing] = useState(false)
  const { pending, run } = useGoalAction(goal)

  const status = goalStatus(goal, today)
  const percent = goalPercent(goal.saved, goal.target_amount)
  const remaining = goalRemaining(goal.saved, goal.target_amount)
  const suggested = suggestedMonthly(goal, today)
  const reached = isReached(goal)
  const overdue = isOverdue(goal, today)

  return (
    <li className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <GoalIcon
          icon={goal.icon}
          color={goal.color}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-medium">{goal.name}</h3>
            <GoalStatusBadge status={status} />
          </div>
          <p className="text-sm text-muted-foreground tabular-nums">
            <span className="font-medium text-foreground">
              {formatCurrency(goal.saved, currency)}
            </span>{" "}
            de {formatCurrency(goal.target_amount, currency)}
          </p>
        </div>

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
      </div>

      <div className="flex items-center gap-3">
        <GoalProgressBar
          percent={percent}
          status={status}
        />
        <span className="text-sm font-medium tabular-nums">
          {formatPercent(percent)}
        </span>
      </div>

      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
          <dt className="text-muted-foreground">Faltan</dt>
          <dd className="font-medium tabular-nums">
            {formatCurrency(remaining, currency)}
          </dd>
        </div>
        <div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
          <dt className="text-muted-foreground">Fecha objetivo</dt>
          <dd className="font-medium">
            {goal.target_date
              ? formatDate(goal.target_date)
              : "Sin fecha objetivo"}
          </dd>
        </div>
        {/* Al llegar al 100 % el aviso reemplaza al aporte sugerido */}
        {suggested !== null && !reached && (
          <div className="flex justify-between gap-2 sm:col-span-2 sm:flex-col sm:justify-start">
            <dt className="text-muted-foreground">Aporte mensual sugerido</dt>
            <dd className="font-medium tabular-nums">
              {formatCurrency(suggested, currency)}
            </dd>
          </div>
        )}
      </dl>

      {overdue && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <TriangleAlert className="size-4 shrink-0" />
          La fecha objetivo ya pasó
        </p>
      )}

      {reached && (
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
