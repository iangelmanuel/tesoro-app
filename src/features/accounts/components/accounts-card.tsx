import { Card, CardContent, cn } from "@heroui/react"
import { Amount } from "@/components/dashboard/amount"
import { CardHeading } from "@/components/dashboard/card-heading"
import { GoalIcon } from "@/features/goals/components/goal-icon"
import { ACCOUNTS_PATH } from "../constants"
import { getAccountBalances } from "../queries"

interface AccountsCardProps {
  workspaceId: string
  currency: string
}

const MAX_ACCOUNTS = 4

// "Saldo en cuentas": suma de los saldos a hoy de las cuentas activas y las
// de mayor saldo
export async function AccountsCard({
  workspaceId,
  currency
}: AccountsCardProps) {
  const accounts = await getAccountBalances(workspaceId)
  const active = accounts.filter((account) => !account.archived_at)
  const total = active.reduce((sum, account) => sum + account.balance, 0)

  return (
    <Card>
      <CardHeading
        title="Saldo en cuentas"
        href={ACCOUNTS_PATH}
        linkLabel="Ver cuentas"
      />
      <CardContent className="flex flex-col gap-4">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span
            className={cn(
              "text-2xl font-semibold tracking-tight tabular-nums",
              total < 0 && "text-danger"
            )}
          >
            <Amount
              value={total}
              currency={currency}
            />
          </span>
          <span className="text-sm text-muted">
            {active.length === 1
              ? "en 1 cuenta"
              : `en ${active.length} cuentas`}
          </span>
        </p>
        {active.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {[...active]
              .sort((a, b) => b.balance - a.balance)
              .slice(0, MAX_ACCOUNTS)
              .map((account) => (
                <li
                  key={account.id}
                  className="flex items-center gap-2.5 text-sm"
                >
                  <GoalIcon
                    icon={account.icon}
                    color={account.color}
                    className="size-6 [&_svg]:size-3.5"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {account.name}
                  </span>
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      account.balance < 0 && "text-danger"
                    )}
                  >
                    <Amount
                      value={account.balance}
                      currency={currency}
                    />
                  </span>
                </li>
              ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
