"use client"

import { useState } from "react"
import { Button, Dropdown, Label } from "@heroui/react"
import {
  Archive,
  CircleCheck,
  EllipsisVertical,
  PartyPopper,
  Pencil
} from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { SURFACE_ITEM } from "@/components/dashboard/surface"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { goalStatus, isReached } from "../progress"
import type { Goal, GoalContribution } from "../queries"
import { GoalDialog } from "./goal-dialog"
import { GoalIcon } from "./goal-icon"
import { GoalStatusBadge } from "./goal-progress-bar"
import { GoalSheet } from "./goal-sheet"
import { GoalSummary } from "./goal-summary"
import { useGoalAction } from "./use-goal-action"

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
  const [detailOpen, setDetailOpen] = useState(false)
  const { pending, run } = useGoalAction(goal)

  return (
    <li className={`flex flex-col gap-4 ${SURFACE_ITEM}`}>
      <div className="flex items-start gap-3">
        {/* Abre el Sheet con el detalle y los aportes */}
        <button
          type="button"
          className="-m-1 flex min-w-0 flex-1 items-start gap-3 rounded-lg p-1 text-left transition-colors hover:bg-default/50 focus-visible:ring-[3px] focus-visible:ring-focus/50 focus-visible:outline-none"
          onClick={() => setDetailOpen(true)}
        >
          <GoalIcon
            icon={goal.icon}
            color={goal.color}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 truncate font-medium">{goal.name}</span>
              <GoalStatusBadge status={goalStatus(goal, today)} />
            </span>
            <span className="text-sm text-muted tabular-nums">
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

        <Dropdown>
          <Button
            variant="ghost"
            isIconOnly
            size="sm"
            className="shrink-0 max-md:size-11"
            aria-label={`Acciones de ${goal.name}`}
            isDisabled={pending}
          >
            <EllipsisVertical />
          </Button>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu aria-label={`Acciones de ${goal.name}`}>
              <Dropdown.Item
                onAction={() => setEditing(true)}
                textValue="Editar"
              >
                <Pencil className="size-4" />
                <Label>Editar</Label>
              </Dropdown.Item>
              <Dropdown.Item
                onAction={() => run("complete")}
                textValue="Marcar como cumplida"
              >
                <CircleCheck className="size-4" />
                <Label>Marcar como cumplida</Label>
              </Dropdown.Item>
              <Dropdown.Item
                onAction={() => run("archive")}
                textValue="Archivar"
              >
                <Archive className="size-4" />
                <Label>Archivar</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
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
            isDisabled={pending}
            onPress={() => run("complete")}
          >
            Marcar como cumplida
          </Button>
        </div>
      )}
    </li>
  )
}
