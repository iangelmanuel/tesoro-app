import { Suspense } from "react"
import { ChartCard } from "@/components/charts/chart-card"
import { Amount } from "@/components/dashboard/data/amount"
import { SITE } from "@/config/site"
import { getAccountBalances } from "@/features/accounts/queries"
import { activeAccountsBalance } from "@/features/accounts/totals"
import { BusinessScoreSummaryCard } from "@/features/business-score/components/business-score-summary-card"
import { BusinessSummaryCards } from "@/features/business/components/business-summary-cards"
import {
  BUSINESS_CHARTS_GRID,
  BusinessSummarySkeleton
} from "@/features/business/components/business-summary-skeleton"
import { buildCategorySlices } from "@/features/reports/chart-data"
import { CategoryDonutChart } from "@/features/reports/components/category-donut-chart"
import { IncomeExpenseChart } from "@/features/reports/components/income-expense-chart"
import { NoPeriodData } from "@/features/reports/components/no-period-data"
import { RecentTransactions } from "@/features/reports/components/recent-transactions"
import { REPORT_LABELS } from "@/features/reports/labels"
import {
  getCategoryTotals,
  getMonthlyTotals,
  getRecentTransactions
} from "@/features/reports/queries"
import { incomeExpenseLegend } from "@/features/reports/series"
import { monthlyTrendSummary } from "@/features/reports/summary"
import { ScoreSummaryCardSkeleton } from "@/features/score/components/score-summary-card"
import { WorkspaceNoTransactions } from "@/features/transactions/components/workspace-no-transactions"
import { workspaceTransactionsPath } from "@/features/workspaces/paths"
import { getWorkspace } from "@/features/workspaces/queries"
import { currentMonth, monthRange, shiftMonth } from "@/libs/dates"
import { formatMonthYear } from "@/libs/format"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Resumen",
  path: SITE.routes.dashboardBusiness,
  noindex: true
})

/** Meses de la gráfica de ventas vs. costos, incluido el actual */
const TREND_MONTHS = 6
const RECENT_TRANSACTIONS = 5

type BusinessSummaryPageProps = PageProps<"/dashboard/business/[id]">

export default function BusinessSummaryPage({
  params
}: BusinessSummaryPageProps) {
  return (
    <section
      aria-label="Resumen"
      className="flex flex-1 flex-col gap-6"
    >
      {/* params, la sesión y la fecha de hoy son dinámicos: van dentro de Suspense */}
      <Suspense fallback={<BusinessSummarySkeleton />}>
        <SummaryContent params={params} />
      </Suspense>
    </section>
  )
}

// El layout ya validó que la empresa es del usuario y no está marcada
async function SummaryContent({
  params
}: Pick<BusinessSummaryPageProps, "params">) {
  const { id } = await params
  const workspace = await getWorkspace(id)
  const labels = REPORT_LABELS.business
  // Mes actual en America/Bogota, no en la zona del servidor
  const month = currentMonth()
  const { from, to } = monthRange(month)
  const trendFrom = monthRange(shiftMonth(month, -(TREND_MONTHS - 1))).from
  const monthLabel = formatMonthYear(month)

  // monthly_totals con o sin cuenta: ventas = ingresos, costos y gastos =
  // gastos. Traspasos y ajustes no cuentan
  const [monthly, costsByCategory, accounts, recent] = await Promise.all([
    getMonthlyTotals(workspace.id, trendFrom, to),
    getCategoryTotals(workspace.id, from, to, "expense"),
    getAccountBalances(workspace.id),
    getRecentTransactions(workspace.id, RECENT_TRANSACTIONS)
  ])

  // Sin movimientos recientes la empresa está vacía: se invita a registrar
  if (recent.length === 0) {
    return (
      <WorkspaceNoTransactions
        workspaceId={workspace.id}
        workspaceType="business"
      />
    )
  }

  const {
    current,
    previous,
    isEmptyTrend,
    trendBalance: trendProfit
  } = monthlyTrendSummary(monthly)
  const accountsBalance = activeAccountsBalance(accounts)

  return (
    <>
      <Suspense fallback={<ScoreSummaryCardSkeleton />}>
        <BusinessScoreSummaryCard workspace={workspace} />
      </Suspense>
      <BusinessSummaryCards
        current={current}
        previous={previous}
        accountsBalance={accountsBalance}
        monthLabel={monthLabel}
        currency={workspace.currency}
      />
      <div className={BUSINESS_CHARTS_GRID}>
        <ChartCard
          title="Entradas vs. salidas"
          figure={
            <Amount
              value={trendProfit}
              currency={workspace.currency}
            />
          }
          figureCaption={`de utilidad en los últimos ${TREND_MONTHS} meses`}
          legend={isEmptyTrend ? undefined : incomeExpenseLegend(labels)}
          className="lg:col-span-3"
        >
          {isEmptyTrend ? (
            <NoPeriodData
              message="No hay movimientos en este periodo"
              className="h-72"
            />
          ) : (
            <IncomeExpenseChart
              data={monthly}
              currency={workspace.currency}
              labels={labels}
              legend="none"
              className="aspect-auto h-72 w-full"
            />
          )}
        </ChartCard>
        <ChartCard
          title={`${labels.expense} por categoría`}
          figure={
            <Amount
              value={current.expense}
              currency={workspace.currency}
            />
          }
          figureCaption={`en ${monthLabel}`}
          className="lg:col-span-2"
        >
          {costsByCategory.length > 0 ? (
            <CategoryDonutChart
              slices={buildCategorySlices(costsByCategory)}
              currency={workspace.currency}
              title={`${labels.expense} por categoría de ${monthLabel}`}
            />
          ) : (
            <NoPeriodData
              message={
                current.txCount === 0
                  ? "No hay movimientos en este periodo"
                  : "No hay salidas en este periodo"
              }
              className="h-72"
            />
          )}
        </ChartCard>
      </div>
      <RecentTransactions
        rows={recent}
        currency={workspace.currency}
        transactionsPath={workspaceTransactionsPath(workspace)}
      />
    </>
  )
}
