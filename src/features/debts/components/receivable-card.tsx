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
import { TONE_TEXT_CLASSES } from "@/components/dashboard/tone"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { formatDate, formatShortDate } from "@/libs/format"
import { hasZeroBalance, isReceivableOverdue } from "../calculations"
import type { Debt, DebtEntry } from "../queries"
import {
  collectedInYear,
  periodPayments,
  receivableInstallments,
  summarizeInstallments
} from "../receivable-schedule"
import { AdjustBalanceDialog } from "./adjust-balance-dialog"
import { ArchiveDebtDialog } from "./archive-debt-dialog"
import { ToneBadge } from "./debt-indicators"
import { ReceivableProgress } from "./debt-progress"
import { DebtSheet } from "./debt-sheet"
import { ReceivableDialog } from "./receivable-dialog"
import { useDebtAction } from "./use-debt-action"

interface ReceivableCardProps {
  /** Cuenta por cobrar activa */
  receivable: Debt
  entries: DebtEntry[]
  /** Cuentas activas, para el movimiento de un abono */
  accounts: PaymentAccountOption[]
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  currency: string
}

export function ReceivableCard({
  receivable,
  entries,
  accounts,
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

  return (
    <li
      className={`flex flex-col gap-4 ${SURFACE_ITEM} ${SURFACE_ITEM_CLICKABLE}`}
      data-tour="debts-card"
    >
      <div className="flex items-start gap-3">
        {/* Abre el Sheet con el detalle y los abonos */}
        <button
          type="button"
          data-card-link
          data-tour="debts-detail"
          className={`-m-1 flex min-w-0 flex-1 flex-col gap-1 rounded-lg p-1 ${CARD_LINK}`}
          onClick={() => setDetailOpen(true)}
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
            <span className="text-xs text-muted">
              {receivable.counterparty}
            </span>
          )}
          <span className="text-2xl font-semibold tabular-nums">
            <Amount
              value={
                isOpenEnded ? (receivable.installment ?? 0) : receivable.balance
              }
              currency={currency}
            />
            {isOpenEnded && (
              <span className="text-sm font-normal text-muted"> al mes</span>
            )}
          </span>
        </button>

        <Dropdown>
          <Button
            variant="ghost"
            isIconOnly
            size="sm"
            className={CARD_OVER_LINK}
            aria-label={`Acciones de ${receivable.name}`}
            isDisabled={pending}
            data-tour="debts-menu"
          >
            <EllipsisVertical />
          </Button>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu aria-label={`Acciones de ${receivable.name}`}>
              <Dropdown.Item
                onAction={() => setEditing(true)}
                textValue="Editar"
              >
                <Pencil className="size-4" />
                <Label>Editar</Label>
              </Dropdown.Item>
              {/* Mes a mes: el saldo sale de las cuotas, sin ajustes */}
              {!isMonthly && (
                <Dropdown.Item
                  onAction={() => setAdjusting(true)}
                  textValue="Actualizar saldo"
                >
                  <RefreshCw className="size-4" />
                  <Label>Actualizar saldo</Label>
                </Dropdown.Item>
              )}
              {zeroBalance && (
                <Dropdown.Item
                  onAction={() => run("markCollected")}
                  textValue="Marcar como cobrada"
                >
                  <CircleCheck className="size-4" />
                  <Label>Marcar como cobrada</Label>
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
        <ReceivableDialog
          receivable={receivable}
          open={editing}
          onOpenChange={setEditing}
        />
        <AdjustBalanceDialog
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
          today={today}
          currency={currency}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      </div>

      {!isOpenEnded && <ReceivableProgress debt={receivable} />}

      {monthly !== null ? (
        <dl className="flex flex-col gap-1 text-sm">
          {isOpenEnded ? (
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Cobrado en {today.slice(0, 4)}</dt>
              <dd className="font-medium">
                <Amount
                  value={monthly.collectedThisYear}
                  currency={currency}
                />
              </dd>
            </div>
          ) : (
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Mensual</dt>
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
              <dt className="text-muted">Por cobrar a la fecha</dt>
              <dd
                className={`font-medium ${monthly.overdueCount > 0 ? TONE_TEXT_CLASSES.danger : ""}`}
              >
                <Amount
                  value={monthly.owed}
                  currency={currency}
                />
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Próxima cuota</dt>
            <dd className="font-medium tabular-nums">
              {monthly.next
                ? formatShortDate(monthly.next.due_on)
                : "Sin cuotas pendientes"}
            </dd>
          </div>
        </dl>
      ) : null}

      {zeroBalance ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Saldo en cero
          </p>
          <Button
            size="sm"
            className={CARD_OVER_LINK}
            isDisabled={pending}
            onPress={() => run("markCollected")}
          >
            Marcar como cobrada
          </Button>
        </div>
      ) : isMonthly ? null : (
        <dl className="text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Fecha esperada</dt>
            <dd className="font-medium">
              {receivable.expected_on
                ? formatDate(receivable.expected_on)
                : "Sin fecha"}
            </dd>
          </div>
        </dl>
      )}
    </li>
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
