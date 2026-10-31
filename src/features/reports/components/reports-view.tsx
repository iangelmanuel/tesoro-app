import { TriangleAlert } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { WorkspaceNoTransactions } from "@/features/transactions/components/workspace-no-transactions"
import type { SearchParams } from "@/features/transactions/filters"
import { hasAnyTransactions } from "@/features/transactions/queries"
import {
  workspaceReportsPath,
  workspaceTransactionsPath
} from "@/features/workspaces/paths"
import type { Workspace } from "@/features/workspaces/queries"
import {
  TOP_CATEGORIES,
  buildCategorySlices,
  buildTopCategories
} from "../chart-data"
import { REPORT_LABELS } from "../labels"
import { parseReportParams } from "../period"
import { getCategoryTotals, getMonthlyTotals } from "../queries"
import { CategoryDonutChart } from "./category-donut-chart"
import { CategorySummaryTable } from "./category-summary-table"
import { IncomeExpenseChart } from "./income-expense-chart"
import { NoPeriodData } from "./no-period-data"
import { ReportPeriodPicker } from "./report-period-picker"
import { ReportTypeToggle } from "./report-type-toggle"
import { TopCategoriesChart } from "./top-categories-chart"

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

  const [monthly, categoryTotals] = await Promise.all([
    getMonthlyTotals(workspace.id, params.from, params.to),
    getCategoryTotals(workspace.id, params.from, params.to, params.type)
  ])

  const isEmptyPeriod = monthly.every((row) => row.txCount === 0)
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

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
                {params.label} · {labels.trend}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncomeExpenseChart
                data={monthly}
                currency={workspace.currency}
                showBalance
                labels={labels}
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
                transactionsPath={workspaceTransactionsPath(workspace)}
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

export function ReportsViewSkeleton() {
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
