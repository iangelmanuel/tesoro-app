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
import { SURFACE_ITEM } from "@/components/dashboard/surface"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { formatCurrency, formatDate } from "@/libs/format"
import { hasZeroBalance, isReceivableOverdue } from "../calculations"
import type { Debt, DebtEntry } from "../queries"
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
  const zeroBalance = hasZeroBalance(receivable)

  function archive() {
    if (receivable.balance > 0) {
      setConfirmArchive(true)
    } else {
      run("archive")
    }
  }

  return (
    <li className={`flex flex-col gap-4 ${SURFACE_ITEM}`}>
      <div className="flex items-start gap-3">
        {/* Abre el Sheet con el detalle y los abonos */}
        <button
          type="button"
          className="-m-1 flex min-w-0 flex-1 flex-col gap-1 rounded-lg p-1 text-left transition-colors hover:bg-default/50 focus-visible:ring-[3px] focus-visible:ring-focus/50 focus-visible:outline-none"
          onClick={() => setDetailOpen(true)}
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{receivable.name}</span>
            {isReceivableOverdue(receivable, today) && (
              <ToneBadge tone="warning">Vencida</ToneBadge>
            )}
          </span>
          {receivable.counterparty && (
            <span className="text-xs text-muted">
              {receivable.counterparty}
            </span>
          )}
          <span className="text-2xl font-semibold tabular-nums">
            {formatCurrency(receivable.balance, currency)}
          </span>
        </button>

        <Dropdown>
          <Button
            variant="ghost"
            isIconOnly
            size="sm"
            aria-label={`Acciones de ${receivable.name}`}
            isDisabled={pending}
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
              <Dropdown.Item
                onAction={() => setAdjusting(true)}
                textValue="Actualizar saldo"
              >
                <RefreshCw className="size-4" />
                <Label>Actualizar saldo</Label>
              </Dropdown.Item>
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

      <ReceivableProgress debt={receivable} />

      {zeroBalance ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Saldo en cero
          </p>
          <Button
            size="sm"
            isDisabled={pending}
            onPress={() => run("markCollected")}
          >
            Marcar como cobrada
          </Button>
        </div>
      ) : (
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
