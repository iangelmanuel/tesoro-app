import { Amount } from "@/components/dashboard/amount"
import { CardHeading } from "@/components/dashboard/card-heading"
import { CARD } from "@/components/dashboard/surface"
import { TONE_TEXT_CLASSES } from "@/components/dashboard/tone"
import { Skeleton } from "@/components/ui/skeleton"
import { GoalIcon } from "@/features/goals/components/goal-icon"
import { cn } from "@/libs/cn"
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
    <section
      aria-label="Saldo en cuentas"
      className={CARD}
      data-tour="summary-accounts"
    >
      <CardHeading
        title="Saldo en cuentas"
        href={ACCOUNTS_PATH}
        linkLabel="Ver cuentas"
      />
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            total < 0 && TONE_TEXT_CLASSES.danger
          )}
        >
          <Amount
            value={total}
            currency={currency}
          />
        </span>
        <span className="text-sm text-muted-foreground">
          {active.length === 1 ? "en 1 cuenta" : `en ${active.length} cuentas`}
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
                <span className="min-w-0 flex-1 truncate">{account.name}</span>
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    account.balance < 0 && TONE_TEXT_CLASSES.danger
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
    </section>
  )
}

/** Misma tarjeta mientras carga: cabecera, total y cuatro filas */
export function AccountsCardSkeleton() {
  return (
    <div className={CARD}>
      <div className="flex min-h-7 items-center justify-between gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="flex items-baseline gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-20" />
      </div>
      <ul className="flex flex-col gap-2.5">
        {Array.from({ length: MAX_ACCOUNTS }, (_, index) => (
          <li
            key={index}
            className="flex items-center gap-2.5"
          >
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 w-24" />
          </li>
        ))}
      </ul>
    </div>
  )
}
