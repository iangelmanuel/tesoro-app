import { Suspense } from "react"
import { ChartCard } from "@/components/charts/chart-card"
import { Amount } from "@/components/dashboard/amount"
import { CardSkeleton } from "@/components/dashboard/card-skeleton"
import { StatCard } from "@/components/dashboard/stat-card"
import { SITE } from "@/config/site"
import { AccountsCard } from "@/features/accounts/components/accounts-card"
import { getAccountBalances } from "@/features/accounts/queries"
import { BudgetsAtRiskCard } from "@/features/budgets/components/budgets-at-risk-card"
import { getCategories } from "@/features/categories/queries"
import { DebtsCard } from "@/features/debts/components/debts-card"
import { GoalsCard } from "@/features/goals/components/goals-card"
import { UpcomingPaymentsCard } from "@/features/recurring-expenses/components/upcoming-payments-card"
import { IncomeExpenseChart } from "@/features/reports/components/income-expense-chart"
import { NoPeriodData } from "@/features/reports/components/no-period-data"
import { RecentTransactions } from "@/features/reports/components/recent-transactions"
import {
  getMonthlyTotals,
  getRecentTransactions,
  getWorkspaceBalance
} from "@/features/reports/queries"
import { incomeExpenseLegend } from "@/features/reports/series"
import { ScoreSummaryCard } from "@/features/score/components/score-summary-card"
import { NoTransactions } from "@/features/transactions/components/transactions-empty"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { currentMonth, monthRange, shiftMonth } from "@/libs/dates"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Resumen",
  path: SITE.routes.dashboardPersonal,
  noindex: true
})

/** Meses de la gráfica de ingresos vs. gastos, incluido el actual */
const TREND_MONTHS = 6
const RECENT_TRANSACTIONS = 5

// El título (saludo) lo pone el header del dashboard: la página no repite
// su propio h1
export default function SummaryPage() {
  return (
    <section
      aria-label="Resumen"
      className="flex flex-1 flex-col gap-4"
    >
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
  const month = currentMonth()
  const { to } = monthRange(month)
  const trendFrom = monthRange(shiftMonth(month, -(TREND_MONTHS - 1))).from

  // Una sola llamada da la gráfica de 6 meses y el mes anterior de las KPI
  const [monthly, accumulatedBalance, recent] = await Promise.all([
    getMonthlyTotals(workspace.id, trendFrom, to),
    getWorkspaceBalance(workspace.id),
    getRecentTransactions(workspace.id, RECENT_TRANSACTIONS)
  ])

  // Sin movimientos el espacio está vacío: se invita a registrar
  if (recent.length === 0) {
    const [categories, accounts] = await Promise.all([
      getCategories(workspace.id),
      getAccountBalances(workspace.id)
    ])
    return (
      <NoTransactions
        workspaceId={workspace.id}
        categories={categories}
        accounts={accounts}
      />
    )
  }

  // monthly_totals rellena los meses vacíos: el último es el actual y el
  // penúltimo el anterior. Sin movimientos el mes anterior, no hay badge
  const current = monthly[monthly.length - 1]
  const previousMonth = monthly[monthly.length - 2]
  const previous = previousMonth.txCount > 0 ? previousMonth : null
  // Saldo acumulado al cierre del mes anterior = el de hoy sin este mes
  const previousAccumulated = accumulatedBalance - current.balance
  const hadHistory = previousAccumulated !== 0 || previous !== null

  const isEmptyTrend = monthly.every((row) => row.txCount === 0)
  const trendBalance = monthly.reduce((sum, row) => sum + row.balance, 0)
  const currency = workspace.currency

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ingresos del mes"
          value={current.income}
          previous={previous?.income}
          trend="higher-is-better"
          currency={currency}
        />
        <StatCard
          label="Gastos del mes"
          value={current.expense}
          previous={previous?.expense}
          trend="lower-is-better"
          currency={currency}
        />
        <StatCard
          label="Balance del mes"
          value={current.balance}
          previous={previous?.balance}
          trend="higher-is-better"
          currency={currency}
        />
        <StatCard
          label="Saldo acumulado"
          value={accumulatedBalance}
          previous={hadHistory ? previousAccumulated : null}
          trend="higher-is-better"
          currency={currency}
          help="accumulatedBalance"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Ingresos vs. gastos"
          figure={
            <Amount
              value={trendBalance}
              currency={currency}
            />
          }
          figureCaption={`de balance en los últimos ${TREND_MONTHS} meses`}
          legend={isEmptyTrend ? undefined : incomeExpenseLegend()}
          className="lg:col-span-2"
        >
          {isEmptyTrend ? (
            <NoPeriodData
              message="No hay movimientos en estos meses"
              className="h-72"
            />
          ) : (
            <IncomeExpenseChart
              data={monthly}
              currency={currency}
              legend="none"
              className="aspect-auto min-h-72 w-full flex-1"
            />
          )}
        </ChartCard>
        <div className="flex flex-col gap-4">
          <Suspense fallback={<CardSkeleton className="h-64" />}>
            <ScoreSummaryCard workspaceId={workspace.id} />
          </Suspense>
          <Suspense fallback={<CardSkeleton className="h-48" />}>
            <AccountsCard
              workspaceId={workspace.id}
              currency={currency}
            />
          </Suspense>
        </div>
      </div>

      <RecentTransactions
        rows={recent}
        currency={currency}
      />

      {/* Tarjetas secundarias: dos por fila, sin huérfanas */}
      <div className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={<CardSkeleton className="h-64" />}>
          <UpcomingPaymentsCard
            workspaceId={workspace.id}
            currency={currency}
          />
        </Suspense>
        <Suspense fallback={<CardSkeleton className="h-64" />}>
          <BudgetsAtRiskCard
            workspaceId={workspace.id}
            currency={currency}
          />
        </Suspense>
        <Suspense fallback={<CardSkeleton className="h-64" />}>
          <GoalsCard
            workspaceId={workspace.id}
            currency={currency}
          />
        </Suspense>
        <Suspense fallback={<CardSkeleton className="h-64" />}>
          <DebtsCard
            workspaceId={workspace.id}
            currency={currency}
          />
        </Suspense>
      </div>
    </>
  )
}

// Misma estructura que el contenido: 4 KPI, gráfica + columna, tabla y
// cuatro tarjetas
function SummarySkeleton() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <CardSkeleton
            key={index}
            className="h-28"
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <CardSkeleton className="h-96 lg:col-span-2" />
        <div className="flex flex-col gap-4">
          <CardSkeleton className="h-64" />
          <CardSkeleton className="h-28" />
        </div>
      </div>
      <CardSkeleton className="h-72" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <CardSkeleton
            key={index}
            className="h-64"
          />
        ))}
      </div>
    </>
  )
}
