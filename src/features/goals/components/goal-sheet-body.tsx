"use client"

import { Minus, Plus } from "lucide-react"
import { DetailSection } from "@/components/dashboard/overlays/detail-sheet"
import { Button } from "@/components/ui/button"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Goal, GoalContribution } from "../queries"
import { ContributionDialog } from "./contribution-dialog"
import { ContributionsList } from "./contributions-list"
import { GoalSummary } from "./goal-summary"

export interface GoalSheetBodyProps {
  workspaceId: string
  goal: Goal
  contributions: GoalContribution[]
  today: string
  currency: string
  accounts?: PaymentAccountOption[]
  /** "Reactivar" en curso (estado de la cabecera, sobrevive al cerrar) */
  pending: boolean
  onReactivate: () => void
}

/**
 * Cuerpo del Sheet de una meta (SPEC 57): resumen, "Aportar" / "Retirar" e
 * historial en el orden de DetailSheet. Se descarga al abrir el panel o al
 * pasar por su tarjeta
 */
export function GoalSheetBody({
  workspaceId,
  goal,
  contributions,
  today,
  currency,
  accounts,
  pending,
  onReactivate
}: GoalSheetBodyProps) {
  const isActive = goal.status === "active"

  return (
    <>
      <GoalSummary
        goal={goal}
        today={today}
        currency={currency}
      />

      {/* Misma caja que el slot `action` de DetailSheet */}
      <div className="flex flex-col gap-2">
        {isActive ? (
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
              onClick={onReactivate}
            >
              Reactivar
            </Button>
          </div>
        )}
      </div>

      <DetailSection title="Historial">
        <ContributionsList
          contributions={contributions}
          currency={currency}
          accounts={accounts}
          readOnly={!isActive}
        />
      </DetailSection>
    </>
  )
}
