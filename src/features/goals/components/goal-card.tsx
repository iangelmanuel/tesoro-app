"use client"

import { useState } from "react"
import {
  Archive,
  CircleCheck,
  EllipsisVertical,
  PartyPopper,
  Pencil
} from "lucide-react"
import { useDetailFromUrl } from "@/components/dashboard/command/use-detail-from-url"
import { Amount } from "@/components/dashboard/data/amount"
import {
  type RowAction,
  RowContextMenu,
  RowMenuBoundary
} from "@/components/dashboard/data/row-actions"
import {
  CARD_LINK,
  CARD_OVER_LINK,
  SURFACE_ITEM,
  SURFACE_ITEM_CLICKABLE
} from "@/components/dashboard/data/surface"
import { TONE_BADGE_CLASSES } from "@/components/dashboard/feedback/tone"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { cn } from "@/libs/cn"
import { goalStatus, isReached } from "../progress"
import type { Goal, GoalContribution } from "../queries"
import { GoalDialog } from "./goal-dialog"
import { GoalIcon } from "./goal-icon"
import { GoalStatusBadge } from "./goal-progress-bar"
import { GoalSheet, preloadGoalSheet } from "./goal-sheet"
import { GoalSummary } from "./goal-summary"
import { useGoalAction } from "./use-goal-action"

/** Contenedor de la tarjeta y de su skeleton: misma superficie y espacios */
const CARD_FRAME = cn(SURFACE_ITEM, "flex flex-col gap-4")

interface GoalCardProps {
  workspaceId: string
  goal: Goal
  contributions: GoalContribution[]
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  currency: string
  accounts: PaymentAccountOption[]
}

export function GoalCard({
  workspaceId,
  goal,
  contributions,
  today,
  currency,
  accounts
}: GoalCardProps) {
  const [editing, setEditing] = useState(false)
  // La paleta de comandos puede abrir este panel (SPEC 51)
  const [detailOpen, setDetailOpen] = useDetailFromUrl(goal.id)
  const { pending, run } = useGoalAction(goal)

  // Las mismas acciones en el botón ⋯ y en el menú contextual (clic derecho
  // y pulsación larga)
  const actions: RowAction[] = [
    {
      id: "edit",
      label: "Editar",
      icon: <Pencil />,
      onAction: () => setEditing(true)
    },
    {
      id: "complete",
      label: "Marcar como cumplida",
      icon: <CircleCheck />,
      onAction: () => run("complete"),
      disabled: pending
    },
    {
      id: "archive",
      label: "Archivar",
      icon: <Archive />,
      onAction: () => run("archive"),
      disabled: pending
    }
  ]

  return (
    <RowContextMenu
      label={goal.name}
      actions={actions}
    >
      <li
        className={cn(CARD_FRAME, SURFACE_ITEM_CLICKABLE)}
        data-tour="goals-card"
      >
        <div className="flex items-start gap-3">
          {/* Abre el Sheet con el detalle y los aportes */}
          <button
            type="button"
            data-card-link
            data-tour="goals-detail"
            className={cn(
              "-m-1 flex min-w-0 flex-1 items-start gap-3 rounded-2xl p-1",
              CARD_LINK
            )}
            onClick={() => setDetailOpen(true)}
            onPointerEnter={preloadGoalSheet}
            onFocus={preloadGoalSheet}
          >
            <GoalIcon
              icon={goal.icon}
              color={goal.color}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 truncate font-medium">
                  {goal.name}
                </span>
                <GoalStatusBadge status={goalStatus(goal, today)} />
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                <span className="font-medium text-foreground">
                  <Amount
                    value={goal.saved}
                    currency={currency}
                  />
                </span>{" "}
                de{" "}
                <Amount
                  value={goal.target_amount}
                  currency={currency}
                />
              </span>
            </span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Acciones de ${goal.name}`}
                  disabled={pending}
                  data-tour="goals-menu"
                  className={cn(CARD_OVER_LINK, "-mt-2 -mr-2 shrink-0")}
                />
              }
            >
              <EllipsisVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-auto min-w-48"
            >
              {actions.map((action) => (
                <DropdownMenuItem
                  key={action.id}
                  disabled={action.disabled}
                  onClick={action.onAction}
                >
                  {action.icon}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <GoalSummary
          goal={goal}
          today={today}
          currency={currency}
        />

        {isReached(goal) && (
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3",
              TONE_BADGE_CLASSES.success
            )}
          >
            <p className="flex items-center gap-2 text-sm font-medium">
              <PartyPopper
                aria-hidden
                className="size-4 shrink-0"
              />
              ¡Lo lograste!
            </p>
            <Button
              size="sm"
              className={CARD_OVER_LINK}
              disabled={pending}
              onClick={() => run("complete")}
            >
              Marcar como cumplida
            </Button>
          </div>
        )}

        {/* El diálogo y el Sheet se pintan en un portal; RowMenuBoundary
            evita que un clic derecho dentro de ellos abra el menú de la
            tarjeta */}
        <RowMenuBoundary>
          <GoalDialog
            goal={goal}
            open={editing}
            onOpenChange={setEditing}
          />
          <GoalSheet
            workspaceId={workspaceId}
            goal={goal}
            contributions={contributions}
            today={today}
            currency={currency}
            accounts={accounts}
            open={detailOpen}
            onOpenChange={setDetailOpen}
          />
        </RowMenuBoundary>
      </li>
    </RowContextMenu>
  )
}

/** Tarjeta de meta mientras carga: ícono, nombre, monto, barra y datos */
export function GoalCardSkeleton() {
  return (
    <li className={CARD_FRAME}>
      <div className="flex items-start gap-3">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-1">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-5 w-44" />
        </div>
        <Skeleton className="-mt-2 -mr-2 size-11 rounded-full" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-2 flex-1 rounded-full" />
        <Skeleton className="h-5 w-10" />
      </div>
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </li>
  )
}
