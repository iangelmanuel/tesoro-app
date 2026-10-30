"use client"

import { useState } from "react"
import type { Route } from "next"
import Link from "next/link"
import { cn } from "cn"
import {
  Archive,
  EllipsisVertical,
  List,
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
import { GoalIcon } from "@/features/goals/components/goal-icon"
import { TRANSACTIONS_PATH } from "@/features/transactions/filters"
import { formatCurrency } from "@/libs/format"
import { ACCOUNT_KIND_META } from "../constants"
import type { AccountWithBalance } from "../types"
import { AccountDialog } from "./account-dialog"
import { AdjustBalanceDialog } from "./adjust-balance-dialog"
import { useAccountAction } from "./use-account-action"

/** Movimientos de la cuenta, de todos los meses */
export function accountTransactionsHref(accountId: string) {
  return `${TRANSACTIONS_PATH}?month=all&account=${accountId}` as Route
}

interface AccountCardProps {
  /** Cuenta activa */
  account: AccountWithBalance
  currency: string
}

export function AccountCard({ account, currency }: AccountCardProps) {
  const [editing, setEditing] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const { pending, run } = useAccountAction(account)
  const hasScheduled = account.scheduled_balance !== account.balance

  return (
    <li className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <GoalIcon
          icon={account.icon}
          color={account.color}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-medium">{account.name}</span>
          <span className="text-sm text-muted-foreground">
            {ACCOUNT_KIND_META[account.kind].label}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Acciones de ${account.name}`}
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
            <DropdownMenuItem onSelect={() => run("archive")}>
              <Archive />
              Archivar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <AccountDialog
          account={account}
          open={editing}
          onOpenChange={setEditing}
        />
        <AdjustBalanceDialog
          account={account}
          currency={currency}
          open={adjusting}
          onOpenChange={setAdjusting}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            account.balance < 0 && "text-destructive"
          )}
        >
          {formatCurrency(account.balance, currency)}
        </span>
        {hasScheduled && (
          <span className="text-sm text-muted-foreground tabular-nums">
            Con lo programado:{" "}
            <span
              className={cn(
                "font-medium text-foreground",
                account.scheduled_balance < 0 && "text-destructive"
              )}
            >
              {formatCurrency(account.scheduled_balance, currency)}
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAdjusting(true)}
        >
          <RefreshCw data-icon="inline-start" />
          Actualizar saldo
        </Button>
        <Button
          variant="ghost"
          size="sm"
          asChild
        >
          <Link href={accountTransactionsHref(account.id)}>
            <List data-icon="inline-start" />
            Ver movimientos
          </Link>
        </Button>
      </div>
    </li>
  )
}
