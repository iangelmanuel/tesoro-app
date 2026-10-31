"use client"

import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible"
import { GoalIcon } from "@/features/goals/components/goal-icon"
import { formatCurrency } from "@/libs/format"
import { ACCOUNT_KIND_META } from "../constants"
import type { AccountWithBalance } from "../types"
import { accountTransactionsHref } from "./account-card"
import { useAccountAction } from "./use-account-action"

interface ArchivedAccountsProps {
  accounts: AccountWithBalance[]
  currency: string
  /** Ruta de Movimientos del espacio, para "Ver movimientos" */
  transactionsPath?: string
}

/** Sección plegable "Archivadas", cerrada por defecto */
export function ArchivedAccounts({
  accounts,
  currency,
  transactionsPath
}: ArchivedAccountsProps) {
  return (
    <Collapsible className="flex flex-col gap-3">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="group w-fit"
        >
          <ChevronDown
            data-icon="inline-start"
            className="transition-transform group-data-[state=closed]:-rotate-90"
          />
          Archivadas ({accounts.length})
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="divide-y rounded-xl border">
          {accounts.map((account) => (
            <ArchivedAccountRow
              key={account.id}
              account={account}
              currency={currency}
              transactionsPath={transactionsPath}
            />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ArchivedAccountRow({
  account,
  currency,
  transactionsPath
}: {
  account: AccountWithBalance
  currency: string
  transactionsPath?: string
}) {
  const { pending, run } = useAccountAction(account)

  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <GoalIcon
        icon={account.icon}
        color={account.color}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-medium">{account.name}</span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {ACCOUNT_KIND_META[account.kind].label} ·{" "}
          {formatCurrency(account.balance, currency)}
        </span>
      </span>
      <Button
        variant="ghost"
        size="sm"
        asChild
      >
        <Link href={accountTransactionsHref(account.id, transactionsPath)}>
          Ver movimientos
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run("restore")}
      >
        Restaurar
      </Button>
    </li>
  )
}
