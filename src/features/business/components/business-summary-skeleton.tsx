import { ChartCardSkeleton } from "@/components/charts/chart-card"
import { RecentTransactionsSkeleton } from "@/features/reports/components/recent-transactions"
import { ScoreSummaryCardSkeleton } from "@/features/score/components/score-summary-card"
import { BusinessSummaryCardsSkeleton } from "./business-summary-cards"

/** Grilla de las dos gráficas del Resumen de Empresa (tendencia y dona) */
export const BUSINESS_CHARTS_GRID = "grid gap-4 lg:grid-cols-5"

/**
 * Resumen de Empresa mientras carga: los skeletons de cada pieza, con la
 * misma grilla que el contenido (score, KPI, gráficas y últimos
 * movimientos). Lo usan el Suspense de la página y su loading.tsx
 */
export function BusinessSummarySkeleton() {
  return (
    <>
      <ScoreSummaryCardSkeleton />
      <BusinessSummaryCardsSkeleton />
      <div className={BUSINESS_CHARTS_GRID}>
        <ChartCardSkeleton
          className="lg:col-span-3"
          chartClassName="aspect-auto h-72"
        />
        <ChartCardSkeleton
          className="lg:col-span-2"
          chartClassName="mx-auto aspect-square max-h-64"
        />
      </div>
      <RecentTransactionsSkeleton />
    </>
  )
}
