"use client"

import { useState, useTransition } from "react"
import { cn } from "cn"
import { Pencil, PiggyBank, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { CardEmpty } from "@/components/dashboard/empty-state"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate } from "@/libs/format"
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
  const isWithdrawal = contribution.amount < 0
  const label = isWithdrawal ? "retiro" : "aporte"

  return (
    <li className="flex items-center gap-3 p-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "font-medium tabular-nums",
            isWithdrawal
              ? "text-rose-600 dark:text-rose-400"
              : "text-emerald-600 dark:text-emerald-400"
          )}
        >
          {isWithdrawal ? "−" : "+"}
          {formatCurrency(Math.abs(contribution.amount), currency)}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDate(contribution.occurred_on)}
        </span>
        {contribution.note && (
          <span className="truncate text-sm text-muted-foreground">
            {contribution.note}
          </span>
        )}
      </div>

      {!readOnly && (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${label}`}
            onClick={() => setEditing(true)}
          >
            <Pencil />
          </Button>
          <ContributionDialog
            goalId={contribution.goal_id}
            contribution={contribution}
            open={editing}
            onOpenChange={setEditing}
          />
          <DeleteContributionButton
            contribution={contribution}
            label={label}
          />
        </div>
      )}
    </li>
  )
}

function DeleteContributionButton({
  contribution,
  label
}: {
  contribution: GoalContribution
  label: string
}) {
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteContribution(contribution.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(
          label === "retiro" ? "Retiro eliminado" : "Aporte eliminado"
        )
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Eliminar ${label}`}
          disabled={pending}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar este {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            Lo ahorrado en la meta se recalcula sin él. Esta acción no se puede
            deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
