import { Suspense } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SITE } from "@/config/site"
import { BudgetsAtRiskCard } from "@/features/budgets/components/budgets-at-risk-card"
import { getCategories } from "@/features/categories/queries"
import { DebtsCard } from "@/features/debts/components/debts-card"
import { GoalsCard } from "@/features/goals/components/goals-card"
import { UpcomingPaymentsCard } from "@/features/recurring-expenses/components/upcoming-payments-card"
import { buildCategorySlices } from "@/features/reports/chart-data"
import { CategoryDonutChart } from "@/features/reports/components/category-donut-chart"
import { IncomeExpenseChart } from "@/features/reports/components/income-expense-chart"
import { NoPeriodData } from "@/features/reports/components/no-period-data"
import { RecentTransactions } from "@/features/reports/components/recent-transactions"
import { SummaryCards } from "@/features/reports/components/summary-cards"
import {
  getCategoryTotals,
  getMonthlyTotals,
  getRecentTransactions,
  getWorkspaceBalance
} from "@/features/reports/queries"
import { ScoreSummaryCard } from "@/features/score/components/score-summary-card"
import { NoTransactions } from "@/features/transactions/components/transactions-empty"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { currentMonth, monthRange, shiftMonth, todayISO } from "@/libs/dates"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Resumen",
  path: SITE.routes.dashboardPersonal,
  noindex: true
})

/** Meses de la gráfica de ingresos vs. gastos, incluido el actual */
const TREND_MONTHS = 6
const RECENT_TRANSACTIONS = 5

export default function SummaryPage() {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Resumen</h1>
        <p className="text-sm text-muted-foreground">
          Tu panorama financiero personal del mes.
        </p>
      </header>
      {/* La sesión y la fecha de hoy son dinámicas: van dentro de Suspense */}
      <Suspense fallback={<SummarySkeleton />}>
        <SummaryContent />
      </Suspense>
    </section>
  )
}

async function SummaryContent() {
  const workspace = await getPersonalWorkspace()
  // Mes actual en America/Bogota, no en la zona del servidor
  const today = todayISO()
  const month = currentMonth()
  const { from, to } = monthRange(month)
  const trendFrom = monthRange(shiftMonth(month, -(TREND_MONTHS - 1))).from
  const monthLabel = format(new Date(`${month}-01T12:00:00`), "MMMM yyyy", {
    locale: es
  })

  const [monthly, expenseByCategory, accumulatedBalance, recent] =
    await Promise.all([
      getMonthlyTotals(workspace.id, trendFrom, to),
      getCategoryTotals(workspace.id, from, to, "expense"),
      getWorkspaceBalance(workspace.id),
      getRecentTransactions(workspace.id, RECENT_TRANSACTIONS)
    ])

  // monthly_totals rellena los meses vacíos: el último es el actual y el
  // penúltimo el anterior
  const current = monthly[monthly.length - 1]
  const previous = monthly[monthly.length - 2]

  // Sin movimientos recientes el espacio está vacío: se invita a registrar
  if (recent.length === 0) {
    const categories = await getCategories(workspace.id)
    return <NoTransactions categories={categories} />
  }

  const isEmptyTrend = monthly.every((row) => row.txCount === 0)

  return (
    <>
      <Suspense fallback={<Skeleton className="h-56" />}>
        <ScoreSummaryCard workspaceId={workspace.id} />
      </Suspense>
      <SummaryCards
        current={current}
        previous={previous}
        topCategory={expenseByCategory[0] ?? null}
        accumulatedBalance={accumulatedBalance}
        today={today}
        currency={workspace.currency}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-72" />}>
          <UpcomingPaymentsCard
            workspaceId={workspace.id}
            currency={workspace.currency}
          />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-72" />}>
          <BudgetsAtRiskCard
            workspaceId={workspace.id}
            currency={workspace.currency}
          />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-72" />}>
          <GoalsCard
            workspaceId={workspace.id}
            currency={workspace.currency}
          />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-72" />}>
          <DebtsCard
            workspaceId={workspace.id}
            currency={workspace.currency}
          />
        </Suspense>
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Ingresos vs. gastos</CardTitle>
            <CardDescription>Últimos {TREND_MONTHS} meses</CardDescription>
          </CardHeader>
          <CardContent>
            {isEmptyTrend ? (
              <NoPeriodData
                message="No hay movimientos en este periodo"
                className="h-72"
              />
            ) : (
              <IncomeExpenseChart
                data={monthly}
                currency={workspace.currency}
                className="aspect-auto h-72 w-full"
              />
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Gastos por categoría</CardTitle>
            <CardDescription className="first-letter:uppercase">
              {monthLabel}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expenseByCategory.length > 0 ? (
              <CategoryDonutChart
                slices={buildCategorySlices(expenseByCategory)}
                currency={workspace.currency}
                title={`Gastos por categoría de ${monthLabel}`}
              />
            ) : (
              <NoPeriodData
                message={
                  current.txCount === 0
                    ? "No hay movimientos en este periodo"
                    : "No hay gastos en este periodo"
                }
                className="h-72"
              />
            )}
          </CardContent>
        </Card>
      </div>
      <RecentTransactions
        rows={recent}
        currency={workspace.currency}
      />
    </>
  )
}

function SummarySkeleton() {
  return (
    <>
      <Skeleton className="h-56" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton
            key={index}
            className="h-28"
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-96 lg:col-span-3" />
        <Skeleton className="h-96 lg:col-span-2" />
      </div>
      <Skeleton className="h-72 w-full" />
    </>
  )
}
