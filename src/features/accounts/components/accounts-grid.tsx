import { Card, cn } from "@heroui/react"
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
      <Card className="gap-2">
        <span className="text-sm text-muted">Saldo en cuentas</span>
        <span
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl",
            total < 0 && "text-danger"
          )}
        >
          {formatCurrency(total, currency)}
        </span>
      </Card>

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
