import { cn } from "cn"
import { ACCOUNT_KIND_META } from "@/features/accounts/constants"
import type { AccountWithBalance } from "@/features/accounts/types"
import { GoalIcon } from "@/features/goals/components/goal-icon"
import { NEGATIVE } from "@/features/reports/change"
import { formatCurrency } from "@/libs/format"

interface AccountBalancesListProps {
  /** Cuentas activas */
  accounts: AccountWithBalance[]
  currency: string
}

/** Saldo a hoy de cada cuenta activa y el total */
export function AccountBalancesList({
  accounts,
  currency
}: AccountBalancesListProps) {
  const total = accounts.reduce((sum, account) => sum + account.balance, 0)

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y">
        {accounts.map((account) => (
          <li
            key={account.id}
            className="flex items-center gap-3 py-2"
          >
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
              {formatCurrency(account.balance, currency)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t pt-3">
        <span className="font-medium">Total</span>
        <span
          className={cn(
            "text-lg font-semibold tabular-nums",
            total < 0 && NEGATIVE
          )}
        >
          {formatCurrency(total, currency)}
        </span>
      </div>
    </div>
  )
}
