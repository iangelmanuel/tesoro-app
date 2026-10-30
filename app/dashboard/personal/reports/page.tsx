import { Suspense } from "react"
import { TriangleAlert } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getAccountBalances } from "@/features/accounts/queries"
import { getCategories } from "@/features/categories/queries"
import {
  TOP_CATEGORIES,
  buildCategorySlices,
  buildTopCategories
} from "@/features/reports/chart-data"
import { CategoryDonutChart } from "@/features/reports/components/category-donut-chart"
import { CategorySummaryTable } from "@/features/reports/components/category-summary-table"
import { IncomeExpenseChart } from "@/features/reports/components/income-expense-chart"
import { NoPeriodData } from "@/features/reports/components/no-period-data"
import { ReportPeriodPicker } from "@/features/reports/components/report-period-picker"
import { ReportTypeToggle } from "@/features/reports/components/report-type-toggle"
import { TopCategoriesChart } from "@/features/reports/components/top-categories-chart"
import { REPORTS_PATH, parseReportParams } from "@/features/reports/period"
import { getCategoryTotals, getMonthlyTotals } from "@/features/reports/queries"
import { NoTransactions } from "@/features/transactions/components/transactions-empty"
import { hasAnyTransactions } from "@/features/transactions/queries"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Reportes",
  path: REPORTS_PATH,
  noindex: true
})

type ReportsPageProps = PageProps<"/dashboard/personal/reports">

export default function ReportsPage({ searchParams }: ReportsPageProps) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Tus ingresos, gastos y categorías en el periodo que elijas.
        </p>
      </header>
      {/* searchParams y la sesión son dinámicos: van dentro de Suspense */}
      <Suspense fallback={<ReportsSkeleton />}>
        <ReportsContent searchParams={searchParams} />
      </Suspense>
    </section>
  )
}

async function ReportsContent({
  searchParams
}: Pick<ReportsPageProps, "searchParams">) {
  const query = await searchParams
  const workspace = await getPersonalWorkspace()
  // Se parsea tras leer la sesión: el periodo por defecto depende de hoy
  const params = parseReportParams(query)

  const [monthly, categoryTotals] = await Promise.all([
    getMonthlyTotals(workspace.id, params.from, params.to),
    getCategoryTotals(workspace.id, params.from, params.to, params.type)
  ])

  const isEmptyPeriod = monthly.every((row) => row.txCount === 0)
  // Solo se consulta cuando el periodo no tiene movimientos
  if (isEmptyPeriod && !(await hasAnyTransactions(workspace.id))) {
    const [categories, accounts] = await Promise.all([
      getCategories(workspace.id),
      getAccountBalances(workspace.id)
    ])
    return (
      <NoTransactions
        categories={categories}
        accounts={accounts}
      />
    )
  }

  const typeLabel = params.type === "expense" ? "Gastos" : "Ingresos"
  const typeNoun = params.type === "expense" ? "gasto" : "ingreso"
  const noTypeData = `No hay ${typeLabel.toLowerCase()} en este periodo`

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <ReportPeriodPicker params={params} />
        <ReportTypeToggle params={params} />
      </div>

      {params.warning && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>{params.warning} Se muestra el mes actual.</p>
        </div>
      )}

      {isEmptyPeriod ? (
        <NoPeriodData
          message="No hay movimientos en este periodo"
          className="py-16"
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Tendencia mensual</CardTitle>
              <CardDescription className="first-letter:uppercase">
                {params.label} · ingresos, gastos y balance por mes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncomeExpenseChart
                data={monthly}
                currency={workspace.currency}
                showBalance
                className="aspect-auto h-80 w-full"
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{typeLabel} por categoría</CardTitle>
                <CardDescription className="first-letter:uppercase">
                  {params.label}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {categoryTotals.length > 0 ? (
                  <CategoryDonutChart
                    slices={buildCategorySlices(categoryTotals)}
                    currency={workspace.currency}
                    title={`${typeLabel} por categoría de ${params.label}`}
                  />
                ) : (
                  <NoPeriodData message={noTypeData} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  Top {TOP_CATEGORIES} categorías de {typeNoun}
                </CardTitle>
                <CardDescription className="first-letter:uppercase">
                  {params.label}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {categoryTotals.length > 0 ? (
                  <TopCategoriesChart
                    categories={buildTopCategories(categoryTotals)}
                    currency={workspace.currency}
                    title={`Top ${TOP_CATEGORIES} categorías de ${typeNoun} de ${params.label}`}
                  />
                ) : (
                  <NoPeriodData message={noTypeData} />
                )}
              </CardContent>
            </Card>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Resumen por categoría</h2>
            {categoryTotals.length > 0 ? (
              <CategorySummaryTable
                totals={categoryTotals}
                params={params}
                currency={workspace.currency}
              />
            ) : (
              <NoPeriodData message={noTypeData} />
            )}
          </section>
        </>
      )}
    </>
  )
}

function ReportsSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-9 w-48" />
      </div>
      <Skeleton className="h-96 w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
      <Skeleton className="h-64 w-full" />
    </>
  )
}
