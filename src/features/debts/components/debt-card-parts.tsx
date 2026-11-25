"use client"

import { EllipsisVertical } from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import { type RowAction } from "@/components/dashboard/data/row-actions"
import { CARD_OVER_LINK } from "@/components/dashboard/data/surface"
import { SURFACE_ITEM } from "@/components/dashboard/data/surface"
import { TONE_BADGE_CLASSES } from "@/components/dashboard/feedback/tone"
import { ToneBadge } from "@/components/dashboard/feedback/tone-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { cn } from "@/libs/cn"
import { formatDate, formatMonthLong } from "@/libs/format"
import { nextPayment } from "../next-payment"
import { debtProjection } from "../projection"
import type { Debt } from "../queries"
import { PaymentStatusBadge } from "./debt-indicators"

/** Marco de la tarjeta de una deuda o cuenta por cobrar */
export const DEBT_CARD_FRAME = cn(SURFACE_ITEM, "flex flex-col gap-4")

/**
 * Botón ⋯ de una tarjeta de deuda o cobro, por encima del enlace estirado.
 * Mismas acciones que el menú contextual
 */
export function DebtCardActionsMenu({
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
            disabled={action.disabled}
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
export function DebtCardZeroBalanceNote({
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

export function DebtCardNextDue({
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
export function DebtCardProjection({ debt }: { debt: Debt }) {
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
          Terminas en {formatMonthLong(projection.payoffMonth)}
          {projection.withoutRate && (
            <span className="text-xs font-normal text-muted-foreground">
              Sin tasa, la proyección no incluye intereses
            </span>
          )}
        </span>
      )
  }
}
