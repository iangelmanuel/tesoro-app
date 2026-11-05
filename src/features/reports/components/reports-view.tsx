import { Card, Skeleton } from "@heroui/react"
import { TriangleAlert } from "lucide-react"
import { ChartCard } from "@/components/charts/chart-card"
import { Amount } from "@/components/dashboard/amount"
import { CardHeading } from "@/components/dashboard/card-heading"
import { CardSkeleton } from "@/components/dashboard/card-skeleton"
import { StatCard } from "@/components/dashboard/stat-card"
import { WorkspaceNoTransactions } from "@/features/transactions/components/workspace-no-transactions"
import type { SearchParams } from "@/features/transactions/filters"
import { hasAnyTransactions } from "@/features/transactions/queries"
import {
  workspaceReportsPath,
  workspaceTransactionsPath
} from "@/features/workspaces/paths"
import type { Workspace } from "@/features/workspaces/queries"
import { monthRange, shiftMonth } from "@/libs/dates"
import { TOP_CATEGORIES, buildTopCategories } from "../chart-data"
import { getPeriodComparison } from "../comparison"
import { REPORT_LABELS } from "../labels"
import { savingsRate } from "../metrics"
import { parseReportParams } from "../period"
import { getCategoryTotals, getMonthlyTotals } from "../queries"
import { incomeExpenseLegend } from "../series"
import { CategorySummaryTable } from "./category-summary-table"
import { IncomeExpenseChart } from "./income-expense-chart"
import { NoPeriodData } from "./no-period-data"
import { ReportPeriodPicker } from "./report-period-picker"
import { ReportTypeToggle } from "./report-type-toggle"
import { TopCategoriesChart } from "./top-categories-chart"

/** La tendencia muestra al menos estos meses, terminando en el periodo */
const MIN_TREND_MONTHS = 6

interface ReportsViewProps {
  workspace: Pick<Workspace, "id" | "type" | "currency">
  searchParams: SearchParams
}

// Contenido de Reportes de cualquier espacio. Va dentro de Suspense: el
// periodo por defecto depende de hoy y las consultas leen la sesión.
export async function ReportsView({
  workspace,
  searchParams
}: ReportsViewProps) {
  const params = parseReportParams(searchParams)
  const labels = REPORT_LABELS[workspace.type]
  const currency = workspace.currency

  // Con un mes (o un trimestre) la tendencia tendría 1–3 barras: se amplía a
  // los 6 meses que terminan en el periodo elegido
  const lastMonth = params.to.slice(0, 7)
  const minTrendFrom = monthRange(
    shiftMonth(lastMonth, -(MIN_TREND_MONTHS - 1))
  ).from
  const trendFrom = params.from < minTrendFrom ? params.from : minTrendFrom

  const [comparison, trend, categoryTotals] = await Promise.all([
    getPeriodComparison(workspace.id, params.from, params.to),
    getMonthlyTotals(workspace.id, trendFrom, params.to),
    getCategoryTotals(workspace.id, params.from, params.to, params.type)
  ])
  const { current, previous } = comparison

  const isEmptyPeriod = current.txCount === 0
  // Solo se consulta cuando el periodo no tiene movimientos
  if (isEmptyPeriod && !(await hasAnyTransactions(workspace.id))) {
    return (
      <WorkspaceNoTransactions
        workspaceId={workspace.id}
        workspaceType={workspace.type}
      />
    )
  }

  const typeLabel = params.type === "expense" ? labels.expense : labels.income
  const typeNoun =
    params.type === "expense" ? labels.expenseNoun : labels.incomeNoun
  const noTypeData = `No hay ${typeLabel.toLowerCase()} en este periodo`
  const rate = savingsRate(current.income, current.expense)
  const previousRate = previous
    ? savingsRate(previous.income, previous.expense)
    : null
  const trendBalance = trend.reduce((sum, row) => sum + row.balance, 0)

  return (
    <>
      {/* Una sola barra: periodo y tipo de las categorías */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ReportPeriodPicker
          params={params}
          path={workspaceReportsPath(workspace)}
        />
        <ReportTypeToggle
          params={params}
          path={workspaceReportsPath(workspace)}
          labels={labels}
        />
      </div>

      {params.warning && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-2xl bg-warning-soft p-3 text-sm text-warning-soft-foreground"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>{params.warning} Se muestra el mes actual.</p>
        </div>
      )}

      <div
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        data-tour="reports-kpis"
      >
        <StatCard
          label={labels.income}
          value={current.income}
          previous={previous?.income}
          trend="higher-is-better"
          currency={currency}
        />
        <StatCard
          label={labels.expense}
          value={current.expense}
          previous={previous?.expense}
          trend="lower-is-better"
          currency={currency}
        />
        <StatCard
          label="Balance"
          value={current.balance}
          previous={previous?.balance}
          trend="higher-is-better"
          currency={currency}
        />
        <StatCard
          label={labels.rate}
          value={rate}
          previous={previousRate}
          trend="higher-is-better"
          format="percent"
          help={workspace.type === "personal" ? "savingsRate" : undefined}
        />
      </div>

      {isEmptyPeriod ? (
        <NoPeriodData
          message="No hay movimientos en este periodo"
          className="py-16"
        />
      ) : (
        <>
          <ChartCard
            title="Tendencia mensual"
            figure={
              <Amount
                value={trendBalance}
                currency={currency}
              />
            }
            figureCaption={`de balance en ${trend.length} meses`}
            legend={incomeExpenseLegend(labels, true)}
            tour="reports-trend"
          >
            <IncomeExpenseChart
              data={trend}
              currency={currency}
              showBalance
              labels={labels}
              legend="none"
              className="aspect-auto h-72 w-full"
            />
          </ChartCard>

          {/* Una sola vista de categorías: el top en barras y, al lado, la
              tabla completa con el enlace a Movimientos */}
          <div className="grid gap-4 lg:grid-cols-5">
            <ChartCard
              title={`Top ${TOP_CATEGORIES} categorías de ${typeNoun}`}
              figure={
                categoryTotals.length > 0 ? (
                  <Amount
                    value={
                      params.type === "expense"
                        ? current.expense
                        : current.income
                    }
                    currency={currency}
                  />
                ) : undefined
              }
              figureCaption={
                categoryTotals.length > 0
                  ? `en ${categoryTotals.length} ${categoryTotals.length === 1 ? "categoría" : "categorías"}`
                  : undefined
              }
              className="lg:col-span-2"
              tour="reports-top"
            >
              {categoryTotals.length > 0 ? (
                <TopCategoriesChart
                  categories={buildTopCategories(categoryTotals)}
                  currency={currency}
                  title={`Top ${TOP_CATEGORIES} categorías de ${typeNoun} de ${params.label}`}
                />
              ) : (
                <NoPeriodData message={noTypeData} />
              )}
            </ChartCard>
            <Card
              className="gap-3 lg:col-span-3"
              data-tour="reports-categories"
            >
              <CardHeading title={`${typeLabel} por categoría`} />
              {categoryTotals.length > 0 ? (
                <CategorySummaryTable
                  totals={categoryTotals}
                  params={params}
                  currency={currency}
                  transactionsPath={workspaceTransactionsPath(workspace)}
                />
              ) : (
                <NoPeriodData message={noTypeData} />
              )}
            </Card>
          </div>
        </>
      )}
    </>
  )
}

export function ReportsViewSkeleton() {
  return (
    <>
      <div className="flex flex-wrap justify-between gap-2">
        <Skeleton className="h-9 w-80 rounded-3xl" />
        <Skeleton className="h-8 w-44 rounded-3xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <CardSkeleton
            key={index}
            className="h-28"
          />
        ))}
      </div>
      <CardSkeleton className="h-96" />
      <div className="grid gap-4 lg:grid-cols-5">
        <CardSkeleton className="h-80 lg:col-span-2" />
        <CardSkeleton className="h-80 lg:col-span-3" />
      </div>
    </>
  )
}
