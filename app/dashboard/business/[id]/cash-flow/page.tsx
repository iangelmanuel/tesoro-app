import { Suspense } from "react"
import type { Route } from "next"
import Link from "next/link"
import { Info, TriangleAlert } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SITE } from "@/config/site"
import { getAccountBalances } from "@/features/accounts/queries"
import { AccountBalancesList } from "@/features/cash-flow/components/account-balances-list"
import { CashFlowChart } from "@/features/cash-flow/components/cash-flow-chart"
import { CashFlowTable } from "@/features/cash-flow/components/cash-flow-table"
import { getCashFlow } from "@/features/cash-flow/queries"
import { NoPeriodData } from "@/features/reports/components/no-period-data"
import { ReportPeriodPicker } from "@/features/reports/components/report-period-picker"
import { parseReportParams } from "@/features/reports/period"
import { WorkspaceNoTransactions } from "@/features/transactions/components/workspace-no-transactions"
import { buildFiltersQuery } from "@/features/transactions/filters"
import { hasAnyTransactions } from "@/features/transactions/queries"
import {
  workspaceCashFlowPath,
  workspaceTransactionsPath
} from "@/features/workspaces/paths"
import { getWorkspace } from "@/features/workspaces/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Flujo de caja",
  path: SITE.routes.dashboardBusiness,
  noindex: true
})

type BusinessCashFlowPageProps = PageProps<"/dashboard/business/[id]/cash-flow">

export default function BusinessCashFlowPage({
  params,
  searchParams
}: BusinessCashFlowPageProps) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Flujo de caja</h1>
        <p className="text-sm text-muted-foreground">
          Lo que entra y sale de tu empresa mes a mes, y cuánto queda en tus
          cuentas.
        </p>
      </header>
      {/* params, searchParams y la sesión son dinámicos: van dentro de Suspense */}
      <Suspense fallback={<CashFlowSkeleton />}>
        <CashFlowContent
          params={params}
          searchParams={searchParams}
        />
      </Suspense>
    </section>
  )
}

// El layout ya validó que la empresa es del usuario y no está marcada
async function CashFlowContent({
  params,
  searchParams
}: BusinessCashFlowPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const workspace = await getWorkspace(id)
  // Se parsea tras leer la sesión: el año por defecto depende de hoy
  const period = parseReportParams(query, undefined, "year")

  const [cashFlow, accounts] = await Promise.all([
    getCashFlow(workspace.id, period.from, period.to),
    getAccountBalances(workspace.id)
  ])
  const activeAccounts = accounts.filter((account) => !account.archived_at)

  const isEmptyPeriod = cashFlow.months.every((row) => row.txCount === 0)
  // Solo se consulta cuando el periodo no tiene movimientos
  if (isEmptyPeriod && !(await hasAnyTransactions(workspace.id))) {
    return (
      <WorkspaceNoTransactions
        workspaceId={workspace.id}
        workspaceType="business"
      />
    )
  }

  // Movimientos solo filtra por mes: con otro periodo el enlace abre todos
  const withoutAccountHref =
    `${workspaceTransactionsPath(workspace)}?${buildFiltersQuery({
      month: period.period === "month" && period.value ? period.value : "all",
      accountId: "none",
      page: 1
    })}` as Route

  return (
    <>
      <ReportPeriodPicker
        params={period}
        path={workspaceCashFlowPath(workspace)}
      />

      {period.warning && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>{period.warning} Se muestra el mes actual.</p>
        </div>
      )}

      {cashFlow.withoutAccount > 0 && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3 text-sm"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p>
            {cashFlow.withoutAccount === 1
              ? "1 movimiento del periodo no tiene cuenta y no mueve el saldo."
              : `${cashFlow.withoutAccount} movimientos del periodo no tienen cuenta y no mueven el saldo.`}{" "}
            <Link
              href={withoutAccountHref}
              className="font-medium underline underline-offset-4"
            >
              Ver movimientos
            </Link>
          </p>
        </div>
      )}

      {isEmptyPeriod ? (
        <NoPeriodData
          message="No hay movimientos en este periodo"
          className="py-16"
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Entradas y salidas</CardTitle>
            <CardDescription className="first-letter:uppercase">
              {period.label} · con el saldo en cuentas al cierre de cada mes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CashFlowChart
              data={cashFlow.months}
              currency={workspace.currency}
              className="aspect-auto h-80 w-full"
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="flex flex-col gap-3 lg:col-span-2">
          <h2 className="text-lg font-semibold">Mes a mes</h2>
          {isEmptyPeriod ? (
            <NoPeriodData message="No hay movimientos en este periodo" />
          ) : (
            <CashFlowTable
              months={cashFlow.months}
              currency={workspace.currency}
            />
          )}
        </section>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Saldo a hoy</CardTitle>
            <CardDescription>
              {activeAccounts.length === 1
                ? "1 cuenta activa"
                : `${activeAccounts.length} cuentas activas`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AccountBalancesList
              accounts={activeAccounts}
              currency={workspace.currency}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function CashFlowSkeleton() {
  return (
    <>
      <Skeleton className="h-9 w-80" />
      <Skeleton className="h-96 w-full" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-96 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    </>
  )
}
