import { StatCard, StatCardSkeleton } from "@/components/dashboard/stat-card"
import {
  globalUtilization,
  totalDebt,
  totalMonthlyInterest
} from "../calculations"
import type { Debt } from "../queries"
import { UtilizationBadge } from "./debt-indicators"

interface DebtTotalsProps {
  /** Todas las deudas; los totales solo cuentan tarjetas y préstamos activos */
  debts: Debt[]
  currency: string
}

/** Contenedor de los KPIs y de su skeleton: misma grilla */
const TOTALS_GRID = "grid gap-4 sm:grid-cols-3"

export function DebtTotals({ debts, currency }: DebtTotalsProps) {
  const utilization = globalUtilization(debts)

  return (
    <div
      className={TOTALS_GRID}
      data-tour="debts-totals"
    >
      <StatCard
        label="Deuda total"
        value={totalDebt(debts)}
        trend="lower-is-better"
        currency={currency}
      />
      <StatCard
        label="Utilización de tarjetas"
        value={utilization}
        trend="lower-is-better"
        format="percent"
        caption={utilization === null ? "Sin tarjetas" : undefined}
        badge={
          utilization === null ? undefined : (
            <UtilizationBadge percent={utilization} />
          )
        }
      />
      <StatCard
        label="Interés estimado del mes"
        value={totalMonthlyInterest(debts)}
        trend="lower-is-better"
        currency={currency}
      />
    </div>
  )
}

/** Los tres KPIs mientras cargan */
export function DebtTotalsSkeleton() {
  return (
    <div className={TOTALS_GRID}>
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  )
}
