"use client"

import { useState } from "react"
import { Button, Dropdown, Label } from "@heroui/react"
import {
  Archive,
  CircleCheck,
  EllipsisVertical,
  Pencil,
  RefreshCw
} from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import {
  CARD_LINK,
  CARD_OVER_LINK,
  SURFACE_ITEM,
  SURFACE_ITEM_CLICKABLE
} from "@/components/dashboard/surface"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { formatCurrency, formatDate } from "@/libs/format"
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

interface DebtCardProps {
  /** Tarjeta o préstamo activo */
  debt: Debt
  entries: DebtEntry[]
  /** Cuentas activas, para el movimiento de un pago */
  accounts: PaymentAccountOption[]
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  currency: string
}

export function DebtCard({
  debt,
  entries,
  accounts,
  today,
  currency
}: DebtCardProps) {
  const [editing, setEditing] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
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

  return (
    <li
      className={`flex flex-col gap-4 ${SURFACE_ITEM} ${SURFACE_ITEM_CLICKABLE}`}
      data-tour="debts-card"
    >
      <div className="flex items-start gap-3">
        {/* Abre el Sheet con el detalle, la proyección y el historial */}
        <button
          type="button"
          data-card-link
          data-tour="debts-detail"
          className={`-m-1 flex min-w-0 flex-1 flex-col gap-1 rounded-lg p-1 ${CARD_LINK}`}
          onClick={() => setDetailOpen(true)}
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{debt.name}</span>
            <span className="text-xs text-muted">
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
          <span className="text-sm text-muted">
            {debt.interest_rate !== null && debt.rate_type !== null
              ? formatRate(debt.interest_rate, debt.rate_type)
              : "Sin tasa"}
          </span>
        </button>

        <Dropdown>
          <Button
            variant="ghost"
            isIconOnly
            size="sm"
            className={CARD_OVER_LINK}
            aria-label={`Acciones de ${debt.name}`}
            isDisabled={pending}
            data-tour="debts-menu"
          >
            <EllipsisVertical />
          </Button>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu aria-label={`Acciones de ${debt.name}`}>
              <Dropdown.Item
                onAction={() => setEditing(true)}
                textValue="Editar"
              >
                <Pencil className="size-4" />
                <Label>Editar</Label>
              </Dropdown.Item>
              <Dropdown.Item
                onAction={() => setAdjusting(true)}
                textValue="Actualizar saldo"
              >
                <RefreshCw className="size-4" />
                <Label>Actualizar saldo</Label>
              </Dropdown.Item>
              {zeroBalance && (
                <Dropdown.Item
                  onAction={() => run("markPaid")}
                  textValue="Marcar como pagada"
                >
                  <CircleCheck className="size-4" />
                  <Label>Marcar como pagada</Label>
                </Dropdown.Item>
              )}
              <Dropdown.Item
                onAction={archive}
                textValue="Archivar"
              >
                <Archive className="size-4" />
                <Label>Archivar</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
        <DebtDialog
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
          today={today}
          currency={currency}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      </div>

      <DebtProgress debt={debt} />

      {zeroBalance ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Saldo en cero
          </p>
          <Button
            size="sm"
            className={CARD_OVER_LINK}
            isDisabled={pending}
            onPress={() => run("markPaid")}
          >
            Marcar como pagada
          </Button>
        </div>
      ) : (
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          <NextDue
            debt={debt}
            today={today}
            currency={currency}
          />
          <div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
            <dt className="text-muted">Proyección</dt>
            <dd className="font-medium">
              <ProjectionSummary debt={debt} />
            </dd>
          </div>
        </dl>
      )}
    </li>
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
      <dt className="text-muted">Próximo pago</dt>
      <dd className="flex flex-wrap items-center gap-2 font-medium">
        {formatDate(payment.dueOn)}
        {payment.amount !== null && (
          <span className="tabular-nums">
            · {formatCurrency(payment.amount, currency)}
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
        <span className="text-muted">
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
            <span className="text-xs font-normal text-muted">
              Sin tasa, la proyección no incluye intereses
            </span>
          )}
        </span>
      )
  }
}
