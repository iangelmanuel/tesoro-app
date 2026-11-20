import { ChartCardSkeleton } from "@/components/charts/chart-card"
import { StatCardSkeleton } from "@/components/dashboard/stat-card"
import { AccountsCardSkeleton } from "@/features/accounts/components/accounts-card"
import { BudgetsAtRiskCardSkeleton } from "@/features/budgets/components/budgets-at-risk-card"
import { DebtsCardSkeleton } from "@/features/debts/components/debts-card"
import { GoalsCardSkeleton } from "@/features/goals/components/goals-card"
import { UpcomingPaymentsCardSkeleton } from "@/features/recurring-expenses/components/upcoming-payments-card"
import { ScoreSummaryCardSkeleton } from "@/features/score/components/score-summary-card"
import { RecentTransactionsSkeleton } from "./recent-transactions"

/**
 * Resumen mientras carga, con el skeleton de cada tarjeta y la misma grilla
 * que el contenido: 4 KPI, gráfica + columna (score y cuentas), últimos
 * movimientos y cuatro tarjetas. La usan el Suspense de la página y su
 * loading.tsx
 */
export function SummarySkeleton() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCardSkeleton
          className="lg:col-span-2"
          chartClassName="aspect-auto min-h-72 flex-1"
        />
        <div className="flex flex-col gap-4">
          <ScoreSummaryCardSkeleton />
          <AccountsCardSkeleton />
        </div>
      </div>
      <RecentTransactionsSkeleton />
      <div className="grid gap-4 md:grid-cols-2">
        <UpcomingPaymentsCardSkeleton />
        <BudgetsAtRiskCardSkeleton />
        <GoalsCardSkeleton />
        <DebtsCardSkeleton />
      </div>
    </>
  )
}
