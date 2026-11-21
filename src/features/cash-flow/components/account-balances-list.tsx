"use client"

import type { Route } from "next"
import { useRouter } from "next/navigation"
import { List, Wallet } from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import {
  type RowAction,
  RowContextMenu
} from "@/components/dashboard/data/row-actions"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/data/surface"
import { Skeleton } from "@/components/ui/skeleton"
import { ACCOUNT_KIND_META } from "@/features/accounts/constants"
import type { AccountWithBalance } from "@/features/accounts/types"
import { GoalIcon } from "@/features/goals/components/goal-icon"
import { NEGATIVE } from "@/features/reports/change"
import { buildFiltersQuery } from "@/features/transactions/filters"
import {
  workspaceBasePath,
  workspaceTransactionsPath
} from "@/features/workspaces/paths"
import { cn } from "@/libs/cn"

const ROW = cn(CARD_ROW, "flex items-center gap-3")
const TOTAL = "flex items-center justify-between border-t border-border pt-3"

interface AccountBalancesListProps {
  /** Cuentas activas */
  accounts: AccountWithBalance[]
  currency: string
  /** Empresa de las cuentas: arma los enlaces a Movimientos y Cuentas */
  workspaceId: string
}

/**
 * Saldo a hoy de cada cuenta activa y el total. Cada fila tiene menú
 * contextual con "Ver movimientos de la cuenta" (Movimientos de la empresa
 * con ?account=<id>, todos los meses) e "Ir a Cuentas"
 */
export function AccountBalancesList({
  accounts,
  currency,
  workspaceId
}: AccountBalancesListProps) {
  const router = useRouter()
  const workspace = { id: workspaceId, type: "business" as const }
  const transactionsPath = workspaceTransactionsPath(workspace)
  const accountsPath = `${workspaceBasePath(workspace)}/accounts` as Route
  const total = accounts.reduce((sum, account) => sum + account.balance, 0)

  return (
    <div className="flex flex-col gap-3">
      <ul className={CARD_LIST}>
        {accounts.map((account) => {
          const actions: RowAction[] = [
            {
              id: "transactions",
              label: "Ver movimientos de la cuenta",
              icon: <List />,
              onAction: () =>
                router.push(
                  `${transactionsPath}?${buildFiltersQuery({
                    month: "all",
                    accountId: account.id,
                    page: 1
                  })}` as Route
                )
            },
            {
              id: "accounts",
              label: "Ir a Cuentas",
              icon: <Wallet />,
              onAction: () => router.push(accountsPath)
            }
          ]

          return (
            <RowContextMenu
              key={account.id}
              label={account.name}
              actions={actions}
            >
              <li className={ROW}>
                <GoalIcon
                  icon={account.icon}
                  color={account.color}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{account.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {ACCOUNT_KIND_META[account.kind].label}
                  </span>
                </div>
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    account.balance < 0 && NEGATIVE
                  )}
                >
                  <Amount
                    value={account.balance}
                    currency={currency}
                  />
                </span>
              </li>
            </RowContextMenu>
          )
        })}
      </ul>
      <div className={TOTAL}>
        <span className="font-medium">Total</span>
        <span
          className={cn(
            "text-lg font-semibold tabular-nums",
            total < 0 && NEGATIVE
          )}
        >
          <Amount
            value={total}
            currency={currency}
          />
        </span>
      </div>
    </div>
  )
}

/** Saldos mientras cargan: mismas filas y la línea del total */
export function AccountBalancesListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-3"
    >
      <ul className={CARD_LIST}>
        {Array.from({ length: rows }, (_, index) => (
          <li
            key={index}
            className={ROW}
          >
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-5 w-24" />
          </li>
        ))}
      </ul>
      <div className={TOTAL}>
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-7 w-32" />
      </div>
    </div>
  )
}
