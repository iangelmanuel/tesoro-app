"use client"

import { useState, useTransition } from "react"
import { cn, toast } from "@heroui/react"
import { Pencil, PiggyBank, Trash2 } from "lucide-react"
import { DeleteDialog } from "@/components/dashboard/delete-dialog"
import { CardEmpty } from "@/components/dashboard/empty-state"
import { RowActions } from "@/components/dashboard/row-actions"
import { formatCurrency, formatDate, formatTime } from "@/libs/format"
import { deleteContribution } from "../actions"
import type { GoalContribution } from "../queries"
import { ContributionDialog } from "./contribution-dialog"

interface ContributionsListProps {
  contributions: GoalContribution[]
  currency: string
  /** Metas cumplidas o archivadas: sin editar ni eliminar */
  readOnly?: boolean
}

export function ContributionsList({
  contributions,
  currency,
  readOnly
}: ContributionsListProps) {
  if (contributions.length === 0) {
    return (
      <CardEmpty
        icon={PiggyBank}
        message="Aún no hay aportes en esta meta"
      />
    )
  }

  return (
    <ul className="divide-y rounded-xl border">
      {contributions.map((contribution) => (
        <ContributionRow
          key={contribution.id}
          contribution={contribution}
          currency={currency}
          readOnly={readOnly}
        />
      ))}
    </ul>
  )
}

function ContributionRow({
  contribution,
  currency,
  readOnly
}: {
  contribution: GoalContribution
  currency: string
  readOnly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [, startTransition] = useTransition()
  const isWithdrawal = contribution.amount < 0
  const label = isWithdrawal ? "retiro" : "aporte"
  // Un aporte sale de la cuenta y un retiro entra a ella
  const accountText = contribution.account_name
    ? `${isWithdrawal ? "A" : "Desde"} ${contribution.account_name}`
    : "Fuera de cuentas"

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteContribution(contribution.id)
      if (result.error) {
        toast.danger(result.error)
      } else {
        toast.success(isWithdrawal ? "Retiro eliminado" : "Aporte eliminado")
      }
    })
  }

  return (
    <li className="flex items-center gap-3 p-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "font-medium tabular-nums",
            isWithdrawal ? "text-(--expense)" : "text-(--income)"
          )}
        >
          {isWithdrawal ? "−" : "+"}
          {formatCurrency(Math.abs(contribution.amount), currency)}
        </span>
        <span className="text-xs text-muted">
          {formatDate(contribution.occurred_on)}
          {contribution.occurred_time &&
            ` · ${formatTime(contribution.occurred_time)}`}{" "}
          · {accountText}
        </span>
        {contribution.note && (
          <span className="line-clamp-3 text-sm break-words text-muted">
            {contribution.note}
          </span>
        )}
      </div>

      {!readOnly && (
        <>
          <RowActions
            label={label}
            actions={[
              {
                id: "edit",
                label: "Editar",
                icon: <Pencil className="size-4" />,
                onAction: () => setEditing(true)
              },
              {
                id: "delete",
                label: "Eliminar",
                icon: <Trash2 className="size-4" />,
                destructive: true,
                onAction: () => setDeleting(true)
              }
            ]}
          />
          <ContributionDialog
            workspaceId={contribution.workspace_id}
            goalId={contribution.goal_id}
            contribution={contribution}
            open={editing}
            onOpenChange={setEditing}
          />
          <DeleteDialog
            open={deleting}
            onOpenChange={setDeleting}
            title={`¿Eliminar este ${label}?`}
            onConfirm={handleDelete}
          >
            <p className="text-sm text-muted">
              Lo ahorrado en la meta se recalcula sin él. Esta acción no se
              puede deshacer.
            </p>
          </DeleteDialog>
        </>
      )}
    </li>
  )
}
