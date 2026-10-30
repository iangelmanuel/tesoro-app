"use client"

import { useState } from "react"
import {
  Archive,
  CircleCheck,
  EllipsisVertical,
  Pencil,
  RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import type { AccountOption } from "@/features/accounts/components/account-select"
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
  accounts: AccountOption[]
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
    <li className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        {/* Abre el Sheet con el detalle y los abonos */}
        <button
          type="button"
          className="-m-1 flex min-w-0 flex-1 flex-col gap-1 rounded-lg p-1 text-left transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          onClick={() => setDetailOpen(true)}
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{receivable.name}</span>
            {isReceivableOverdue(receivable, today) && (
              <ToneBadge tone="warning">Vencida</ToneBadge>
            )}
          </span>
          {receivable.counterparty && (
            <span className="text-xs text-muted-foreground">
              {receivable.counterparty}
            </span>
          )}
          <span className="text-2xl font-semibold tabular-nums">
            {formatCurrency(receivable.balance, currency)}
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Acciones de ${receivable.name}`}
              disabled={pending}
            >
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setAdjusting(true)}>
              <RefreshCw />
              Actualizar saldo
            </DropdownMenuItem>
            {zeroBalance && (
              <DropdownMenuItem onSelect={() => run("markCollected")}>
                <CircleCheck />
                Marcar como cobrada
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={archive}>
              <Archive />
              Archivar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
            disabled={pending}
            onClick={() => run("markCollected")}
          >
            Marcar como cobrada
          </Button>
        </div>
      ) : (
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
    </li>
  )
}
