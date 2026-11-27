"use client"

import { Suspense } from "react"
import { Amount } from "@/components/dashboard/data/amount"
import {
  DetailSheet,
  DetailSheetSkeleton
} from "@/components/dashboard/overlays/detail-sheet"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { lazyWithPreload } from "@/libs/lazy-with-preload"
import { goalStatus } from "../progress"
import type { Goal, GoalContribution } from "../queries"
import { GoalIcon } from "./goal-icon"
import { GoalStatusBadge } from "./goal-progress-bar"
import { useGoalAction } from "./use-goal-action"

// Resumen, aportes e historial se descargan al abrir el panel o al pasar
// por su tarjeta (SPEC 57)
const GoalSheetBody = lazyWithPreload(() =>
  import("./goal-sheet-body").then((m) => m.GoalSheetBody)
)

/** Precarga el cuerpo del Sheet de meta: `onPointerEnter` / `onFocus` */
export const preloadGoalSheet = GoalSheetBody.preload

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
 * cumplidas o archivadas son de solo lectura, con "Reactivar". La cabecera
 * y el estado que sobrevive al cerrar viven aquí; el cuerpo es diferido
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
        <Suspense fallback={<DetailSheetSkeleton />}>
          <GoalSheetBody.Component
            workspaceId={workspaceId}
            goal={goal}
            contributions={contributions}
            today={today}
            currency={currency}
            accounts={accounts}
            pending={pending}
            onReactivate={() => run("reactivate")}
          />
        </Suspense>
      }
    />
  )
}
