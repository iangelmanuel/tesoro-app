import { cn } from "cn"
import { formatCurrency } from "@/libs/format"
import type { AccountWithBalance } from "../types"
import { AccountCard } from "./account-card"

interface AccountsGridProps {
  /** Cuentas activas */
  accounts: AccountWithBalance[]
  currency: string
  /** Ruta de Movimientos del espacio, para "Ver movimientos" */
  transactionsPath?: string
}

/** Total "Saldo en cuentas" y una tarjeta por cuenta activa */
export function AccountsGrid({
  accounts,
  currency,
  transactionsPath
}: AccountsGridProps) {
  const total = accounts.reduce((sum, account) => sum + account.balance, 0)

  return (
    <>
      <div className="flex flex-col gap-1 rounded-xl border p-4">
        <span className="text-sm text-muted-foreground">Saldo en cuentas</span>
        <span
          className={cn(
            "text-3xl font-semibold tracking-tight tabular-nums",
            total < 0 && "text-destructive"
          )}
        >
          {formatCurrency(total, currency)}
        </span>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            currency={currency}
            transactionsPath={transactionsPath}
          />
        ))}
      </ul>
    </>
  )
}
