"use client"

import { useState, useTransition } from "react"
import { cn, toast } from "@heroui/react"
import { Copy, Pencil, PiggyBank, Trash2 } from "lucide-react"
import { DeleteDialog } from "@/components/dashboard/delete-dialog"
import { CardEmpty } from "@/components/dashboard/empty-state"
import { RowActions } from "@/components/dashboard/row-actions"
import {
  type SortableConfig,
  SortableListItem,
  SortableListProvider,
  useSortableList
} from "@/components/dashboard/sortable-list"
import { activeAccountId } from "@/features/accounts/active-account"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { formatCurrency, formatDate, formatTime } from "@/libs/format"
import { deleteContribution, moveContribution } from "../actions"
import type { GoalContribution } from "../queries"
import { ContributionDialog } from "./contribution-dialog"

interface ContributionsListProps {
  contributions: GoalContribution[]
  currency: string
  /** Cuentas con saldo para el duplicado (SPEC 49) */
  accounts?: PaymentAccountOption[]
  /** Metas cumplidas o archivadas: sin editar, duplicar ni eliminar */
  readOnly?: boolean
}

export function ContributionsList({
  contributions,
  currency,
  accounts = [],
  readOnly
}: ContributionsListProps) {
  // Orden manual dentro del día (SPEC 45), como en Movimientos
  const sortable = useSortableList({
    items: contributions,
    getId: (contribution) => contribution.id,
    getGroup: (contribution) => contribution.occurred_on,
    getTitle: (contribution) =>
      `${contribution.amount < 0 ? "Retiro" : "Aporte"} · ${formatDate(contribution.occurred_on)}`,
    handleLabel: "Reordenar dentro del día",
    enabled: !readOnly,
    onMove: (source, target) => moveContribution(source.id, target.id)
  })

  if (contributions.length === 0) {
    return (
      <CardEmpty
        icon={PiggyBank}
        message="Aún no hay aportes en esta meta"
      />
    )
  }

  return (
    <SortableListProvider {...sortable.providerProps}>
      <ul className="divide-y rounded-xl border">
        {sortable.items.map((contribution) => (
          <ContributionRow
            key={contribution.id}
            contribution={contribution}
            currency={currency}
            accounts={accounts}
            readOnly={readOnly}
            sortable={sortable.configFor(contribution)}
          />
        ))}
      </ul>
    </SortableListProvider>
  )
}

function ContributionRow({
  contribution,
  currency,
  accounts,
  readOnly,
  sortable
}: {
  contribution: GoalContribution
  currency: string
  accounts: PaymentAccountOption[]
  readOnly?: boolean
  sortable?: SortableConfig
}) {
  const [editing, setEditing] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
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
    <SortableListItem
      config={sortable}
      className="flex items-center gap-3 p-3"
    >
      {(handle) => (
        <>
          {handle}
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
                    id: "duplicate",
                    label: "Duplicar",
                    icon: <Copy className="size-4" />,
                    onAction: () => setDuplicating(true)
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
              {/* Mismo tipo en la misma meta, con fecha de hoy (SPEC 49) */}
              {duplicating && (
                <ContributionDialog
                  workspaceId={contribution.workspace_id}
                  goalId={contribution.goal_id}
                  kind={isWithdrawal ? "withdrawal" : "deposit"}
                  accounts={accounts}
                  initialValues={{
                    amount: Math.abs(contribution.amount),
                    account_id: activeAccountId(
                      accounts,
                      contribution.account_id
                    ),
                    note: contribution.note ?? ""
                  }}
                  open
                  onOpenChange={setDuplicating}
                />
              )}
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
        </>
      )}
    </SortableListItem>
  )
}
