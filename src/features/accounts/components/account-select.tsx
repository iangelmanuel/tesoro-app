"use client"

import { GoalIcon } from "@/features/goals/components/goal-icon"
import type { AccountWithBalance } from "../types"

export type AccountOption = Pick<
  AccountWithBalance,
  "id" | "name" | "icon" | "color" | "archived_at"
>

export function accountName(account: AccountOption) {
  return account.archived_at ? `${account.name} (archivada)` : account.name
}

export function AccountLabel({ account }: { account: AccountOption }) {
  return (
    <span className="flex items-center gap-2">
      <GoalIcon
        icon={account.icon}
        color={account.color}
        className="size-5 [&_svg]:size-3"
      />
      {accountName(account)}
    </span>
  )
}

/** Cuentas activas más la de `currentId`, si está archivada */
export function selectableAccounts<T extends AccountOption>(
  accounts: T[],
  currentId?: string | null
) {
  return accounts.filter(
    (account) => !account.archived_at || account.id === currentId
  )
}
