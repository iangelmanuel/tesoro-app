"use client"

import { Minus, Plus } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { DetailSection, DetailSheet } from "@/components/dashboard/detail-sheet"
import { Button } from "@/components/ui/button"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { goalStatus } from "../progress"
import type { Goal, GoalContribution } from "../queries"
import { ContributionDialog } from "./contribution-dialog"
import { ContributionsList } from "./contributions-list"
import { GoalIcon } from "./goal-icon"
import { GoalStatusBadge } from "./goal-progress-bar"
import { GoalSummary } from "./goal-summary"
import { useGoalAction } from "./use-goal-action"

interface GoalSheetProps {
  /** Espacio de la meta (para crear una cuenta desde el aporte) */
  workspaceId: string
  goal: Goal
  contributions: GoalContribution[]
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  currency: string
  /** Cuentas con saldo para aportar; solo las metas activas las usan */
  accounts?: PaymentAccountOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Detalle de la meta: resumen, "Aportar" / "Retirar" e historial. Las metas
 * cumplidas o archivadas son de solo lectura, con "Reactivar".
 */
export function GoalSheet({
  workspaceId,
  goal,
  contributions,
  today,
  currency,
  accounts,
  open,
  onOpenChange
}: GoalSheetProps) {
  const isActive = goal.status === "active"
  const { pending, run } = useGoalAction(goal)

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={goal.name}
      leading={
        <GoalIcon
          icon={goal.icon}
          color={goal.color}
        />
      }
      status={<GoalStatusBadge status={goalStatus(goal, today)} />}
      figure={
        <Amount
          value={goal.saved}
          currency={currency}
        />
      }
      figureCaption={
        <>
          de{" "}
          <Amount
            value={goal.target_amount}
            currency={currency}
          />
        </>
      }
      summary={
        <GoalSummary
          goal={goal}
          today={today}
          currency={currency}
        />
      }
      action={
        isActive ? (
          <div className="flex flex-wrap gap-2">
            <ContributionDialog
              workspaceId={workspaceId}
              goalId={goal.id}
              kind="deposit"
              accounts={accounts}
              trigger={
                <Button className="min-w-fit flex-1">
                  <Plus />
                  Aportar
                </Button>
              }
            />
            <ContributionDialog
              workspaceId={workspaceId}
              goalId={goal.id}
              kind="withdrawal"
              accounts={accounts}
              trigger={
                <Button
                  className="min-w-fit flex-1"
                  variant="outline"
                >
                  <Minus />
                  Retirar
                </Button>
              }
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-subtle p-4">
            <p className="text-sm text-muted-foreground">
              {goal.status === "completed"
                ? "Meta cumplida."
                : "Meta archivada."}{" "}
              Reactívala para registrar aportes.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run("reactivate")}
            >
              Reactivar
            </Button>
          </div>
        )
      }
      history={
        <DetailSection title="Historial">
          <ContributionsList
            contributions={contributions}
            currency={currency}
            accounts={accounts}
            readOnly={!isActive}
          />
        </DetailSection>
      }
    />
  )
}
