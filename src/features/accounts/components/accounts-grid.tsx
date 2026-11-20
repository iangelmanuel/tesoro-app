import { Amount } from "@/components/dashboard/amount"
import { CARD } from "@/components/dashboard/surface"
import { TONE_TEXT_CLASSES } from "@/components/dashboard/tone"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/libs/cn"
import type { AccountWithBalance } from "../types"
import { AccountCard, AccountCardSkeleton } from "./account-card"

interface AccountsGridProps {
  /** Cuentas activas */
  accounts: AccountWithBalance[]
  currency: string
  /** Ruta de Movimientos del espacio, para "Ver movimientos" */
  transactionsPath?: string
}

const TOTAL_FRAME = cn(CARD, "gap-2")
const GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"

/** Total "Saldo en cuentas" y una tarjeta por cuenta activa */
export function AccountsGrid({
  accounts,
  currency,
  transactionsPath
}: AccountsGridProps) {
  const total = accounts.reduce((sum, account) => sum + account.balance, 0)

  return (
    <>
      <div
        className={TOTAL_FRAME}
        data-tour="accounts-total"
      >
        <span className="text-sm text-muted-foreground">Saldo en cuentas</span>
        <span
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl",
            total < 0 && TONE_TEXT_CLASSES.danger
          )}
        >
          <Amount
            value={total}
            currency={currency}
          />
        </span>
      </div>

      <ul className={GRID}>
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

/** Total y tarjetas mientras cargan, con el mismo contenedor */
export function AccountsGridSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <>
      <div className={TOTAL_FRAME}>
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-8 w-48 sm:h-9" />
      </div>
      <ul
        aria-hidden="true"
        className={GRID}
      >
        {Array.from({ length: cards }, (_, index) => (
          <AccountCardSkeleton key={index} />
        ))}
      </ul>
    </>
  )
}

/**
 * Pantalla de Cuentas mientras carga: botón "Nueva cuenta", total y
 * tarjetas. La usan el Suspense de la página y su loading.tsx
 */
export function AccountsScreenSkeleton() {
  return (
    <>
      <Skeleton className="h-11 w-40 rounded-4xl" />
      <AccountsGridSkeleton />
    </>
  )
}
