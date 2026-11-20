"use client"

import { useState } from "react"
import {
  Archive,
  CircleCheck,
  EllipsisVertical,
  Pencil,
  RefreshCw
} from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { useDetailFromUrl } from "@/components/dashboard/command/use-detail-from-url"
import {
  type RowAction,
  RowContextMenu,
  RowMenuBoundary
} from "@/components/dashboard/row-actions"
import {
  CARD_LINK,
  CARD_OVER_LINK,
  SURFACE_ITEM,
  SURFACE_ITEM_CLICKABLE
} from "@/components/dashboard/surface"
import { TONE_BADGE_CLASSES } from "@/components/dashboard/tone"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { cn } from "@/libs/cn"
import { formatDate } from "@/libs/format"
import {
  debtProjection,
  formatMonthYear,
  formatRate,
  hasZeroBalance,
  nextPayment
} from "../calculations"
import type { Debt, DebtEntry } from "../queries"
import { AdjustBalanceDialog } from "./adjust-balance-dialog"
import { ArchiveDebtDialog } from "./archive-debt-dialog"
import { DebtDialog } from "./debt-dialog"
import { PaymentStatusBadge, ToneBadge } from "./debt-indicators"
import { DebtProgress } from "./debt-progress"
import { DebtSheet } from "./debt-sheet"
import { useDebtAction } from "./use-debt-action"

const KIND_LABELS = { credit_card: "Tarjeta", loan: "Préstamo" } as const

/** Contenedor de la tarjeta de deuda o cobro y de su skeleton */
export const DEBT_CARD_FRAME = cn(SURFACE_ITEM, "flex flex-col gap-4")

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
            isDisabled: pending
          }
        ]
      : []),
    {
      id: "archive",
      label: "Archivar",
      icon: <Archive />,
      onAction: archive,
      isDisabled: pending
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

          <CardActionsMenu
            label={debt.name}
            actions={actions}
            disabled={pending}
          />
        </div>

        <DebtProgress debt={debt} />

        {zeroBalance ? (
          <ZeroBalanceNote
            action="Marcar como pagada"
            disabled={pending}
            onAction={() => run("markPaid")}
          />
        ) : (
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            <NextDue
              debt={debt}
              today={today}
              currency={currency}
            />
            <div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
              <dt className="text-muted-foreground">Proyección</dt>
              <dd className="font-medium">
                <ProjectionSummary debt={debt} />
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
          <AdjustBalanceDialog
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

/**
 * Botón ⋯ de una tarjeta de deuda o cobro, por encima del enlace estirado.
 * Mismas acciones que el menú contextual
 */
export function CardActionsMenu({
  label,
  actions,
  disabled
}: {
  label: string
  actions: RowAction[]
  disabled?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Acciones de ${label}`}
            disabled={disabled}
            data-tour="debts-menu"
            className={cn(CARD_OVER_LINK, "-mt-2 -mr-2")}
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
            disabled={action.isDisabled}
            onClick={action.onAction}
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** "Saldo en cero" con la acción de cerrar la deuda o el cobro */
export function ZeroBalanceNote({
  action,
  disabled,
  onAction
}: {
  action: string
  disabled?: boolean
  onAction: () => void
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3",
        TONE_BADGE_CLASSES.success
      )}
    >
      <p className="text-sm font-medium">Saldo en cero</p>
      <Button
        size="sm"
        className={CARD_OVER_LINK}
        disabled={disabled}
        onClick={onAction}
      >
        {action}
      </Button>
    </div>
  )
}

function NextDue({
  debt,
  today,
  currency
}: {
  debt: Debt
  today: string
  currency: string
}) {
  const payment = nextPayment(debt, today)

  if (payment === null) {
    return null
  }

  return (
    <div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
      <dt className="text-muted-foreground">Próximo pago</dt>
      <dd className="flex flex-wrap items-center gap-2 font-medium">
        {formatDate(payment.dueOn)}
        {payment.amount !== null && (
          <span className="tabular-nums">
            ·{" "}
            <Amount
              value={payment.amount}
              currency={currency}
            />
          </span>
        )}
        {payment.status && <PaymentStatusBadge status={payment.status} />}
      </dd>
    </div>
  )
}

/** Proyección corta: "Terminas en octubre de 2027" o el aviso que aplique */
export function ProjectionSummary({ debt }: { debt: Debt }) {
  const projection = debtProjection(debt)

  if (projection === null) {
    return null
  }

  switch (projection.kind) {
    case "needs_min_payment":
      return (
        <span className="text-muted-foreground">
          Agrega el pago mínimo para ver la proyección
        </span>
      )
    case "no_progress":
      return <ToneBadge tone="danger">Con este pago la deuda no baja</ToneBadge>
    case "too_long":
      return <ToneBadge tone="warning">Más de 50 años</ToneBadge>
    case "ok":
      return (
        <span className="flex flex-col">
          Terminas en {formatMonthYear(projection.payoffMonth)}
          {projection.withoutRate && (
            <span className="text-xs font-normal text-muted-foreground">
              Sin tasa, la proyección no incluye intereses
            </span>
          )}
        </span>
      )
  }
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
