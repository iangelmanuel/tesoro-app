"use client"

import { Button, Drawer } from "@heroui/react"
import { Minus, Plus } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
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
    <Drawer
      isOpen={open}
      onOpenChange={onOpenChange}
    >
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="w-full sm:max-w-md">
            <Drawer.CloseTrigger aria-label="Cerrar" />
            <Drawer.Header>
              <div className="flex items-center gap-3">
                <GoalIcon
                  icon={goal.icon}
                  color={goal.color}
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Drawer.Heading className="truncate">
                      {goal.name}
                    </Drawer.Heading>
                    <GoalStatusBadge status={goalStatus(goal, today)} />
                  </div>
                  <p className="text-sm text-muted tabular-nums">
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
                </div>
              </div>
            </Drawer.Header>
            <Drawer.Body>
              <div className="flex flex-col gap-6">
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
                      accounts={accounts}
                      trigger={
                        <Button>
                          <Plus />
                          Aportar
                        </Button>
                      }
                    />
                    <ContributionDialog
                      goalId={goal.id}
                      kind="withdrawal"
                      accounts={accounts}
                      trigger={
                        <Button variant="outline">
                          <Minus />
                          Retirar
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3">
                    <p className="text-sm text-muted">
                      {goal.status === "completed"
                        ? "Meta cumplida."
                        : "Meta archivada."}{" "}
                      Reactívala para registrar aportes.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      isDisabled={pending}
                      onPress={() => run("reactivate")}
                    >
                      Reactivar
                    </Button>
                  </div>
                )}

                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-medium text-muted uppercase">
                    Historial
                  </h3>
                  <ContributionsList
                    contributions={contributions}
                    currency={currency}
                    readOnly={!isActive}
                  />
                </section>
              </div>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  )
}
