import { Suspense } from "react"
import { ArrowLeftRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SITE } from "@/config/site"
import { TransferDialog } from "@/features/accounts/components/transfer-dialog"
import { getAccountBalances } from "@/features/accounts/queries"
import { CategoriesSheet } from "@/features/categories/components/categories-sheet"
import { getCategories } from "@/features/categories/queries"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import {
  NoFilteredTransactions,
  NoTransactions
} from "@/features/transactions/components/transactions-empty"
import { TransactionsFilters } from "@/features/transactions/components/transactions-filters"
import { TransactionsPagination } from "@/features/transactions/components/transactions-pagination"
import { TransactionsTable } from "@/features/transactions/components/transactions-table"
import { TransactionsTotals } from "@/features/transactions/components/transactions-totals"
import { parseTransactionFilters } from "@/features/transactions/filters"
import {
  getTransactionTotals,
  getTransactions,
  hasAnyLedgerEntries
} from "@/features/transactions/queries"
import { workspaceTransactionsPath } from "@/features/workspaces/paths"
import { getWorkspace } from "@/features/workspaces/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Movimientos",
  path: SITE.routes.dashboardBusiness,
  noindex: true
})

type BusinessTransactionsPageProps =
  PageProps<"/dashboard/business/[id]/transactions">

export default function BusinessTransactionsPage({
  params,
  searchParams
}: BusinessTransactionsPageProps) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>
        <p className="text-sm text-muted-foreground">
          Las ventas, los costos y gastos, y los traspasos entre cuentas de tu
          empresa.
        </p>
      </header>
      {/* params, searchParams y la sesión son dinámicos: van dentro de Suspense */}
      <Suspense fallback={<TransactionsSkeleton />}>
        <TransactionsContent
          params={params}
          searchParams={searchParams}
        />
      </Suspense>
    </section>
  )
}

// El layout ya validó que la empresa es del usuario y no está marcada
async function TransactionsContent({
  params,
  searchParams
}: BusinessTransactionsPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const workspace = await getWorkspace(id)
  const path = workspaceTransactionsPath(workspace)
  // Se parsea tras leer la sesión: el mes por defecto usa la fecha de hoy, y
  // new Date() solo se permite después de connection()
  const filters = parseTransactionFilters(query)
  const [categories, accounts, { rows, count }, totals] = await Promise.all([
    getCategories(workspace.id),
    getAccountBalances(workspace.id),
    getTransactions(workspace.id, filters),
    getTransactionTotals(workspace.id, filters)
  ])
  // Solo se consulta cuando los filtros no devuelven nada
  const isEmptyWorkspace =
    rows.length === 0 && !(await hasAnyLedgerEntries(workspace.id))
  // Un traspaso necesita al menos dos cuentas activas
  const canTransfer =
    accounts.filter((account) => !account.archived_at).length > 1

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <TransactionDialog
          workspaceId={workspace.id}
          workspaceType={workspace.type}
          categories={categories}
          accounts={accounts}
          trigger={
            <Button>
              <Plus data-icon="inline-start" />
              Nuevo movimiento
            </Button>
          }
        />
        {canTransfer && (
          <TransferDialog
            workspaceId={workspace.id}
            accounts={accounts}
            trigger={
              <Button variant="outline">
                <ArrowLeftRight data-icon="inline-start" />
                Traspaso
              </Button>
            }
          />
        )}
        <CategoriesSheet
          workspaceId={workspace.id}
          categories={categories}
        />
      </div>

      {isEmptyWorkspace ? (
        <NoTransactions
          workspaceId={workspace.id}
          workspaceType={workspace.type}
          categories={categories}
          accounts={accounts}
        />
      ) : (
        <>
          <TransactionsFilters
            path={path}
            filters={filters}
            categories={categories}
            accounts={accounts}
          />
          <TransactionsTotals
            totals={totals}
            currency={workspace.currency}
          />
          {rows.length > 0 ? (
            <TransactionsTable
              workspaceId={workspace.id}
              workspaceType={workspace.type}
              rows={rows}
              categories={categories}
              accounts={accounts}
              currency={workspace.currency}
            />
          ) : (
            <NoFilteredTransactions
              path={path}
              filters={filters}
            />
          )}
          <TransactionsPagination
            path={path}
            filters={filters}
            count={count}
          />
        </>
      )}
    </>
  )
}

function TransactionsSkeleton() {
  return (
    <>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-8 w-full" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-96 w-full" />
    </>
  )
}
