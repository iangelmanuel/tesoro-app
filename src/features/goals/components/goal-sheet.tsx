"use client"

import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet"
import { formatCurrency } from "@/libs/format"
import { goalStatus } from "../progress"
import type { Goal, GoalContribution } from "../queries"
import { ContributionDialog } from "./contribution-dialog"
import { ContributionsList } from "./contributions-list"
import { GoalIcon } from "./goal-icon"
import { GoalStatusBadge } from "./goal-progress-bar"
import { GoalSummary } from "./goal-summary"
import { useGoalAction } from "./use-goal-action"

interface GoalSheetProps {
  goal: Goal
  contributions: GoalContribution[]
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Detalle de la meta: resumen, "Aportar" / "Retirar" e historial. Las metas
 * cumplidas o archivadas son de solo lectura, con "Reactivar".
 */
export function GoalSheet({
  goal,
  contributions,
  today,
  currency,
  open,
  onOpenChange
}: GoalSheetProps) {
  const isActive = goal.status === "active"
  const { pending, run } = useGoalAction(goal)

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <GoalIcon
              icon={goal.icon}
              color={goal.color}
            />
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="truncate">{goal.name}</SheetTitle>
                <GoalStatusBadge status={goalStatus(goal, today)} />
              </div>
              <SheetDescription className="tabular-nums">
                {formatCurrency(goal.saved, currency)} de{" "}
                {formatCurrency(goal.target_amount, currency)}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4">
          <div className="flex flex-col gap-4">
            <GoalSummary
              goal={goal}
              today={today}
              currency={currency}
            />
          </div>

          {isActive ? (
            <div className="grid grid-cols-2 gap-2">
              <ContributionDialog
                goalId={goal.id}
                kind="deposit"
                trigger={
                  <Button>
                    <Plus data-icon="inline-start" />
                    Aportar
                  </Button>
                }
              />
              <ContributionDialog
                goalId={goal.id}
                kind="withdrawal"
                trigger={
                  <Button variant="outline">
                    <Minus data-icon="inline-start" />
                    Retirar
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3">
              <p className="text-sm text-muted-foreground">
                {goal.status === "completed"
                  ? "Meta cumplida."
                  : "Meta archivada."}{" "}
                Reactívala para registrar aportes.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => run("reactivate")}
              >
                Reactivar
              </Button>
            </div>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase">
              Historial
            </h3>
            <ContributionsList
              contributions={contributions}
              currency={currency}
              readOnly={!isActive}
            />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
