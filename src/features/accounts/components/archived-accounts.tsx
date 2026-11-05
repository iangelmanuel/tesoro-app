"use client"

import Link from "next/link"
import { Button, Disclosure, buttonVariants } from "@heroui/react"
import { Amount } from "@/components/dashboard/amount"
import { GoalIcon } from "@/features/goals/components/goal-icon"
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
    <Disclosure className="flex flex-col gap-3">
      <Disclosure.Heading>
        <Disclosure.Trigger
          className="flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-default"
          data-tour="accounts-archived"
        >
          <Disclosure.Indicator />
          Archivadas ({accounts.length})
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <ul className="divide-y divide-separator rounded-3xl bg-surface px-2 shadow-(--surface-shadow)">
          {accounts.map((account) => (
            <ArchivedAccountRow
              key={account.id}
              account={account}
              currency={currency}
              transactionsPath={transactionsPath}
            />
          ))}
        </ul>
      </Disclosure.Content>
    </Disclosure>
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
        <span className="text-sm text-muted tabular-nums">
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
        variant="outline"
        size="sm"
        isDisabled={pending}
        onPress={() => run("restore")}
      >
        Restaurar
      </Button>
    </li>
  )
}
