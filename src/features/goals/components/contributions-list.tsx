"use client"

import { useState, useTransition } from "react"
import { AlertDialog, Button, cn, toast } from "@heroui/react"
import { Pencil, PiggyBank, Trash2 } from "lucide-react"
import { CardEmpty } from "@/components/dashboard/empty-state"
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
  const isWithdrawal = contribution.amount < 0
  const label = isWithdrawal ? "retiro" : "aporte"
  // Un aporte sale de la cuenta y un retiro entra a ella
  const accountText = contribution.account_name
    ? `${isWithdrawal ? "A" : "Desde"} ${contribution.account_name}`
    : "Fuera de cuentas"

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
          <span className="truncate text-sm text-muted">
            {contribution.note}
          </span>
        )}
      </div>

      {!readOnly && (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            isIconOnly
            size="sm"
            aria-label={`Editar ${label}`}
            onPress={() => setEditing(true)}
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
        toast.danger(result.error)
      } else {
        toast.success(
          label === "retiro" ? "Retiro eliminado" : "Aporte eliminado"
        )
      }
    })
  }

  return (
    <AlertDialog>
      <Button
        variant="ghost"
        isIconOnly
        size="sm"
        aria-label={`Eliminar ${label}`}
        isDisabled={pending}
      >
        <Trash2 />
      </Button>
      <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-md">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>¿Eliminar este {label}?</AlertDialog.Heading>
              <AlertDialog.Body>
                <p className="text-sm text-muted">
                  Lo ahorrado en la meta se recalcula sin él. Esta acción no se
                  puede deshacer.
                </p>
              </AlertDialog.Body>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <Button
                slot="close"
                variant="tertiary"
              >
                Cancelar
              </Button>
              <Button
                slot="close"
                variant="danger"
                onPress={handleDelete}
              >
                Eliminar
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
