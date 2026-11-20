"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { SURFACE_LIST, SURFACE_ROW } from "@/components/dashboard/surface"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible"
import { GoalIcon } from "@/features/goals/components/goal-icon"
import { cn } from "@/libs/cn"
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
      <h2 className="w-fit">
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              className="group/archived px-3"
            />
          }
          data-tour="accounts-archived"
        >
          <ChevronRight
            aria-hidden
            className="group-data-panel-open/archived:rotate-90 motion-safe:transition-transform"
          />
          Archivadas ({accounts.length})
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent>
        <ul className={SURFACE_LIST}>
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
    <li className={cn(SURFACE_ROW, "flex flex-wrap items-center gap-3")}>
      <GoalIcon
        icon={account.icon}
        color={account.color}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-medium">{account.name}</span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {ACCOUNT_KIND_META[account.kind].label} ·{" "}
          <Amount
            value={account.balance}
            currency={currency}
          />
        </span>
      </span>
      <Link
        href={accountTransactionsHref(account.id, transactionsPath)}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        Ver movimientos
      </Link>
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => run("restore")}
      >
        Restaurar
      </Button>
    </li>
  )
}
