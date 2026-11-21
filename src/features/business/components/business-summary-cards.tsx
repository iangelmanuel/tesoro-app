import {
  StatCard,
  StatCardSkeleton
} from "@/components/dashboard/data/stat-card"
import { NEGATIVE, POSITIVE } from "@/features/reports/change"
import { savingsRate } from "@/features/reports/metrics"
import type { MonthlyTotal } from "@/features/reports/queries"

interface BusinessSummaryCardsProps {
  /** Totales del mes actual: income = ventas, expense = costos y gastos */
  current: MonthlyTotal
  /** Totales del mes anterior, para la variación */
  previous: MonthlyTotal
  /** Σ saldo a hoy de las cuentas activas */
  accountsBalance: number
  /** "octubre 2026" */
  monthLabel: string
  currency: string
}

// Las dos filas de KPI: tres del mes (con variación) y dos de contexto
const MAIN_GRID = "grid gap-4 sm:grid-cols-3"
const SECONDARY_GRID = "grid gap-4 sm:grid-cols-2"

/**
 * Entradas, salidas y utilidad (entradas − salidas) del mes con su
 * variación vs. el mes anterior, más margen y saldo en cuentas. Sin
 * movimientos el mes anterior, no hay badge (como en Personal)
 */
export function BusinessSummaryCards({
  current,
  previous,
  accountsBalance,
  monthLabel,
  currency
}: BusinessSummaryCardsProps) {
  const base = previous.txCount > 0 ? previous : null
  const month = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
  // Utilidad / entradas × 100: la misma cuenta que la tasa de ahorro
  const margin = savingsRate(current.income, current.expense)

  return (
    <div className="flex flex-col gap-4">
      <div className={MAIN_GRID}>
        <StatCard
          label={`Entradas · ${month}`}
          value={current.income}
          previous={base?.income}
          trend="higher-is-better"
          currency={currency}
        />
        <StatCard
          label={`Salidas · ${month}`}
          value={current.expense}
          previous={base?.expense}
          trend="lower-is-better"
          currency={currency}
        />
        <StatCard
          label={`Utilidad · ${month}`}
          value={current.balance}
          previous={base?.balance}
          trend="higher-is-better"
          currency={currency}
          valueClassName={current.balance < 0 ? NEGATIVE : POSITIVE}
        />
      </div>
      <div className={SECONDARY_GRID}>
        <StatCard
          label="Margen"
          value={margin}
          trend="higher-is-better"
          format="percent"
          caption="Utilidad sobre las entradas del mes"
          valueClassName={margin !== null && margin < 0 ? NEGATIVE : undefined}
          size="sm"
        />
        <StatCard
          label="Saldo en cuentas"
          value={accountsBalance}
          trend="higher-is-better"
          currency={currency}
          caption="Hoy, en las cuentas activas"
          valueClassName={accountsBalance < 0 ? NEGATIVE : undefined}
          size="sm"
        />
      </div>
    </div>
  )
}

/** KPI del Resumen de Empresa mientras cargan: mismas grillas y tarjetas */
export function BusinessSummaryCardsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className={MAIN_GRID}>
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className={SECONDARY_GRID}>
        <StatCardSkeleton
          size="sm"
          caption
        />
        <StatCardSkeleton
          size="sm"
          caption
        />
      </div>
    </div>
  )
}
