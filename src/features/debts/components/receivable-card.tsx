"use client"

import { useState } from "react"
import { Archive, CircleCheck, Pencil, RefreshCw } from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import {
  type RowAction,
  RowContextMenu,
  RowMenuBoundary
} from "@/components/dashboard/data/row-actions"
import {
  CARD_LINK,
  SURFACE_ITEM_CLICKABLE
} from "@/components/dashboard/data/surface"
import { TONE_TEXT_CLASSES } from "@/components/dashboard/feedback/tone"
import { ToneBadge } from "@/components/dashboard/feedback/tone-badge"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { cn } from "@/libs/cn"
import { formatDate, formatShortDate } from "@/libs/format"
import { hasZeroBalance, isReceivableOverdue } from "../calculations"
import type { Debt, DebtEntry } from "../queries"
import {
  collectedInYear,
  periodPayments,
  receivableInstallments,
  summarizeInstallments
} from "../receivable-schedule"
import { AdjustDebtBalanceDialog } from "./adjust-debt-balance-dialog"
import { ArchiveDebtDialog } from "./archive-debt-dialog"
import {
  DEBT_CARD_FRAME,
  DebtCardActionsMenu,
  DebtCardZeroBalanceNote
} from "./debt-card-parts"
import { ReceivableProgress } from "./debt-progress"
import { DebtSheet, preloadDebtSheet } from "./debt-sheet"
import { ReceivableDialog } from "./receivable-dialog"
import { useDebtAction } from "./use-debt-action"

interface ReceivableCardProps {
  /** Cuenta por cobrar activa */
  receivable: Debt
  entries: DebtEntry[]
  /** Cuentas activas, para el movimiento de un abono */
  accounts: PaymentAccountOption[]
  /** Categorías del espacio, para editar el movimiento de un abono */
  categories: Category[]
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  currency: string
}

export function ReceivableCard({
  receivable,
  entries,
  accounts,
  categories,
  today,
  currency
}: ReceivableCardProps) {
  const [editing, setEditing] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const { pending, run } = useDebtAction(receivable)
  // Cobro mes a mes (SPEC 28): cuota fija; indefinida = sin saldo total
  const isMonthly = receivable.schedule === "monthly"
  const isOpenEnded = isMonthly && receivable.term_months === null
  const zeroBalance = hasZeroBalance(receivable)
  const monthly = isMonthly ? monthlySummary(receivable, entries, today) : null

  function archive() {
    if (receivable.balance > 0) {
      setConfirmArchive(true)
    } else {
      run("archive")
    }
  }

  // Las mismas acciones en el botón ⋯ y en el menú contextual (clic derecho
  // y pulsación larga). Mes a mes: el saldo sale de las cuotas, sin ajustes
  const actions: RowAction[] = [
    {
      id: "edit",
      label: "Editar",
      icon: <Pencil />,
      onAction: () => setEditing(true)
    },
    ...(isMonthly
      ? []
      : [
          {
            id: "adjust",
            label: "Actualizar saldo",
            icon: <RefreshCw />,
            onAction: () => setAdjusting(true)
          }
        ]),
    ...(zeroBalance
      ? [
          {
            id: "mark-collected",
            label: "Marcar como cobrada",
            icon: <CircleCheck />,
            onAction: () => run("markCollected"),
            disabled: pending
          }
        ]
      : []),
    {
      id: "archive",
      label: "Archivar",
      icon: <Archive />,
      onAction: archive,
      disabled: pending
    }
  ]

  return (
    <RowContextMenu
      label={receivable.name}
      actions={actions}
    >
      <li
        className={cn(DEBT_CARD_FRAME, SURFACE_ITEM_CLICKABLE)}
        data-tour="debts-card"
      >
        <div className="flex items-start gap-3">
          {/* Abre el Sheet con el detalle y los abonos */}
          <button
            type="button"
            data-card-link
            data-tour="debts-detail"
            className={cn(
              "-m-1 flex min-w-0 flex-1 flex-col gap-1 rounded-2xl p-1",
              CARD_LINK
            )}
            onClick={() => setDetailOpen(true)}
            onPointerEnter={preloadDebtSheet}
            onFocus={preloadDebtSheet}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium">{receivable.name}</span>
              {isReceivableOverdue(receivable, today) && (
                <ToneBadge tone="warning">Vencida</ToneBadge>
              )}
              {monthly !== null && monthly.overdueCount > 0 && (
                <ToneBadge tone="danger">
                  {monthly.overdueCount === 1
                    ? "1 cuota atrasada"
                    : `${monthly.overdueCount} cuotas atrasadas`}
                </ToneBadge>
              )}
            </span>
            {receivable.counterparty && (
              <span className="text-xs text-muted-foreground">
                {receivable.counterparty}
              </span>
            )}
            <span className="text-2xl font-semibold tabular-nums">
              <Amount
                value={
                  isOpenEnded
                    ? (receivable.installment ?? 0)
                    : receivable.balance
                }
                currency={currency}
              />
              {isOpenEnded && (
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  al mes
                </span>
              )}
            </span>
          </button>

          <DebtCardActionsMenu
            label={receivable.name}
            actions={actions}
            disabled={pending}
          />
        </div>

        {!isOpenEnded && <ReceivableProgress debt={receivable} />}

        {monthly !== null ? (
          <dl className="flex flex-col gap-1 text-sm">
            {isOpenEnded ? (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">
                  Cobrado en {today.slice(0, 4)}
                </dt>
                <dd className="font-medium">
                  <Amount
                    value={monthly.collectedThisYear}
                    currency={currency}
                  />
                </dd>
              </div>
            ) : (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Mensual</dt>
                <dd className="font-medium">
                  <Amount
                    value={receivable.installment ?? 0}
                    currency={currency}
                  />
                </dd>
              </div>
            )}
            {monthly.owed > 0 && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Por cobrar a la fecha</dt>
                <dd
                  className={cn(
                    "font-medium",
                    monthly.overdueCount > 0 && TONE_TEXT_CLASSES.danger
                  )}
                >
                  <Amount
                    value={monthly.owed}
                    currency={currency}
                  />
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Próxima cuota</dt>
              <dd className="font-medium tabular-nums">
                {monthly.next
                  ? formatShortDate(monthly.next.due_on)
                  : "Sin cuotas pendientes"}
              </dd>
            </div>
          </dl>
        ) : null}

        {zeroBalance ? (
          <DebtCardZeroBalanceNote
            action="Marcar como cobrada"
            disabled={pending}
            onAction={() => run("markCollected")}
          />
        ) : isMonthly ? null : (
          <dl className="text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Fecha esperada</dt>
              <dd className="font-medium">
                {receivable.expected_on
                  ? formatDate(receivable.expected_on)
                  : "Sin fecha"}
              </dd>
            </div>
          </dl>
        )}

        {/* Los diálogos y el Sheet se pintan en un portal; RowMenuBoundary
          evita que un clic derecho dentro de ellos abra el menú de la
          tarjeta */}
        <RowMenuBoundary>
          <ReceivableDialog
            workspaceId={receivable.workspace_id}
            accounts={accounts}
            receivable={receivable}
            open={editing}
            onOpenChange={setEditing}
          />
          <AdjustDebtBalanceDialog
            debt={receivable}
            currency={currency}
            open={adjusting}
            onOpenChange={setAdjusting}
          />
          <ArchiveDebtDialog
            name={receivable.name}
            open={confirmArchive}
            onOpenChange={setConfirmArchive}
            onConfirm={() => run("archive")}
          />
          <DebtSheet
            debt={receivable}
            entries={entries}
            accounts={accounts}
            categories={categories}
            today={today}
            currency={currency}
            open={detailOpen}
            onOpenChange={setDetailOpen}
          />
        </RowMenuBoundary>
      </li>
    </RowContextMenu>
  )
}

/**
 * Atrasadas, por cobrar, próxima cuota y cobrado en el año de una mensual
 * (SPEC 28 y 29)
 */
function monthlySummary(receivable: Debt, entries: DebtEntry[], today: string) {
  return {
    ...summarizeInstallments(
      receivableInstallments(receivable, entries, today),
      today
    ),
    collectedThisYear: collectedInYear(periodPayments(entries), today)
  }
}
