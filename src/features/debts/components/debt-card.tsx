"use client"

import { useState } from "react"
import { Archive, CircleCheck, Pencil, RefreshCw } from "lucide-react"
import { useDetailFromUrl } from "@/components/dashboard/command/use-detail-from-url"
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
import { Skeleton } from "@/components/ui/skeleton"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { cn } from "@/libs/cn"
import { hasZeroBalance } from "../calculations"
import { formatRate } from "../projection"
import type { Debt, DebtEntry } from "../queries"
import { AdjustDebtBalanceDialog } from "./adjust-debt-balance-dialog"
import { ArchiveDebtDialog } from "./archive-debt-dialog"
import {
  DEBT_CARD_FRAME,
  DebtCardActionsMenu,
  DebtCardNextDue,
  DebtCardProjection,
  DebtCardZeroBalanceNote
} from "./debt-card-parts"
import { DebtDialog } from "./debt-dialog"
import { DebtProgress } from "./debt-progress"
import { DebtSheet } from "./debt-sheet"
import { useDebtAction } from "./use-debt-action"

const KIND_LABELS = { credit_card: "Tarjeta", loan: "Préstamo" } as const

/** Contenedor de la tarjeta de deuda o cobro y de su skeleton */

interface DebtCardProps {
  /** Tarjeta o préstamo activo */
  debt: Debt
  entries: DebtEntry[]
  /** Cuentas activas, para el movimiento de un pago */
  accounts: PaymentAccountOption[]
  /** Categorías del espacio, para editar el movimiento de un pago */
  categories: Category[]
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  currency: string
}

export function DebtCard({
  debt,
  entries,
  accounts,
  categories,
  today,
  currency
}: DebtCardProps) {
  const [editing, setEditing] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  // La paleta de comandos puede abrir este panel (SPEC 51)
  const [detailOpen, setDetailOpen] = useDetailFromUrl(debt.id)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const { pending, run } = useDebtAction(debt)
  const zeroBalance = hasZeroBalance(debt)

  function archive() {
    if (debt.balance > 0) {
      setConfirmArchive(true)
    } else {
      run("archive")
    }
  }

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
      id: "adjust",
      label: "Actualizar saldo",
      icon: <RefreshCw />,
      onAction: () => setAdjusting(true)
    },
    ...(zeroBalance
      ? [
          {
            id: "mark-paid",
            label: "Marcar como pagada",
            icon: <CircleCheck />,
            onAction: () => run("markPaid"),
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
      label={debt.name}
      actions={actions}
    >
      <li
        className={cn(DEBT_CARD_FRAME, SURFACE_ITEM_CLICKABLE)}
        data-tour="debts-card"
      >
        <div className="flex items-start gap-3">
          {/* Abre el Sheet con el detalle, la proyección y el historial */}
          <button
            type="button"
            data-card-link
            data-tour="debts-detail"
            className={cn(
              "-m-1 flex min-w-0 flex-1 flex-col gap-1 rounded-2xl p-1",
              CARD_LINK
            )}
            onClick={() => setDetailOpen(true)}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium">{debt.name}</span>
              <span className="text-xs text-muted-foreground">
                {debt.kind === "loan"
                  ? KIND_LABELS.loan
                  : KIND_LABELS.credit_card}
                {debt.counterparty && ` · ${debt.counterparty}`}
              </span>
            </span>
            <span className="text-2xl font-semibold tabular-nums">
              <Amount
                value={debt.balance}
                currency={currency}
              />
            </span>
            <span className="text-sm text-muted-foreground">
              {debt.interest_rate !== null && debt.rate_type !== null
                ? formatRate(debt.interest_rate, debt.rate_type)
                : "Sin tasa"}
            </span>
          </button>

          <DebtCardActionsMenu
            label={debt.name}
            actions={actions}
            disabled={pending}
          />
        </div>

        <DebtProgress debt={debt} />

        {zeroBalance ? (
          <DebtCardZeroBalanceNote
            action="Marcar como pagada"
            disabled={pending}
            onAction={() => run("markPaid")}
          />
        ) : (
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            <DebtCardNextDue
              debt={debt}
              today={today}
              currency={currency}
            />
            <div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
              <dt className="text-muted-foreground">Proyección</dt>
              <dd className="font-medium">
                <DebtCardProjection debt={debt} />
              </dd>
            </div>
          </dl>
        )}

        {/* Los diálogos y el Sheet se pintan en un portal; RowMenuBoundary
            evita que un clic derecho dentro de ellos abra el menú de la
            tarjeta */}
        <RowMenuBoundary>
          <DebtDialog
            workspaceId={debt.workspace_id}
            accounts={accounts}
            debt={debt}
            open={editing}
            onOpenChange={setEditing}
          />
          <AdjustDebtBalanceDialog
            debt={debt}
            currency={currency}
            open={adjusting}
            onOpenChange={setAdjusting}
          />
          <ArchiveDebtDialog
            name={debt.name}
            open={confirmArchive}
            onOpenChange={setConfirmArchive}
            onConfirm={() => run("archive")}
          />
          <DebtSheet
            debt={debt}
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

/** Tarjeta de deuda o cobro mientras carga: cabecera, saldo, barra y datos */
export function DebtCardSkeleton() {
  return (
    <li className={DEBT_CARD_FRAME}>
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="-mt-2 -mr-2 size-11 rounded-full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </li>
  )
}
