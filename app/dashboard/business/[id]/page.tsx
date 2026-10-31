import { Suspense } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Skeleton } from "@/components/ui/skeleton"
import { SITE } from "@/config/site"
import { getAccountBalances } from "@/features/accounts/queries"
import { BusinessSummaryCards } from "@/features/business/components/business-summary-cards"
import { getCategories } from "@/features/categories/queries"
import { RecentTransactions } from "@/features/reports/components/recent-transactions"
import { getRecentTransactions } from "@/features/reports/queries"
import { NoTransactions } from "@/features/transactions/components/transactions-empty"
import { getTransactionTotals } from "@/features/transactions/queries"
import { workspaceTransactionsPath } from "@/features/workspaces/paths"
import { getWorkspace } from "@/features/workspaces/queries"
import { currentMonth } from "@/libs/dates"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Resumen",
  path: SITE.routes.dashboardBusiness,
  noindex: true
})

const RECENT_TRANSACTIONS = 5

type BusinessSummaryPageProps = PageProps<"/dashboard/business/[id]">

export default function BusinessSummaryPage({
  params
}: BusinessSummaryPageProps) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Resumen</h1>
        <p className="text-sm text-muted-foreground">
          Las ventas, los costos y la utilidad de tu empresa en el mes.
        </p>
      </header>
      {/* params, la sesión y la fecha de hoy son dinámicos: van dentro de Suspense */}
      <Suspense fallback={<SummarySkeleton />}>
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
  // Mes actual en America/Bogota, no en la zona del servidor
  const month = currentMonth()
  const monthLabel = format(new Date(`${month}-01T12:00:00`), "MMMM yyyy", {
    locale: es
  })

  // transaction_totals con el rango del mes: ventas = ingresos, costos y
  // gastos = gastos. Traspasos y ajustes no cuentan
  const [totals, recent] = await Promise.all([
    getTransactionTotals(workspace.id, { month, page: 1 }),
    getRecentTransactions(workspace.id, RECENT_TRANSACTIONS)
  ])

  return (
    <>
      <BusinessSummaryCards
        totals={totals}
        monthLabel={monthLabel}
        currency={workspace.currency}
      />
      {recent.length > 0 ? (
        <RecentTransactions
          rows={recent}
          currency={workspace.currency}
          transactionsPath={workspaceTransactionsPath(workspace)}
        />
      ) : (
        <EmptyBusiness workspaceId={workspace.id} />
      )}
    </>
  )
}

// Sin movimientos se invita a registrar la primera venta o gasto
async function EmptyBusiness({ workspaceId }: { workspaceId: string }) {
  const [categories, accounts] = await Promise.all([
    getCategories(workspaceId),
    getAccountBalances(workspaceId)
  ])

  return (
    <NoTransactions
      workspaceId={workspaceId}
      workspaceType="business"
      categories={categories}
      accounts={accounts}
    />
  )
}

function SummarySkeleton() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-72 w-full" />
    </>
  )
}
