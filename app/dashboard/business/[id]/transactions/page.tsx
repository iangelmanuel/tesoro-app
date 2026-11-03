import { Suspense } from "react"
import { Button, Skeleton } from "@heroui/react"
import { Plus } from "lucide-react"
import { CardSkeleton } from "@/components/dashboard/card-skeleton"
import { SITE } from "@/config/site"
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
    <section
      aria-label="Movimientos"
      className="flex flex-1 flex-col gap-6"
    >
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
              <Plus />
              Nuevo movimiento
            </Button>
          }
        />
        {/* En el teléfono las categorías van dentro de la hoja de filtros */}
        <div className="hidden md:block">
          <CategoriesSheet
            workspaceId={workspace.id}
            categories={categories}
          />
        </div>
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
            categoriesAction={
              <CategoriesSheet
                fullWidthTrigger
                workspaceId={workspace.id}
                categories={categories}
              />
            }
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
              canReorder={!workspace.deletionRequestedAt && !filters.q}
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
        <Skeleton className="h-8 w-40 rounded-3xl" />
        <Skeleton className="hidden h-8 w-32 rounded-3xl md:block" />
      </div>
      <div className="flex flex-wrap gap-2">
        {/* Mismo orden que los filtros: buscador; mes + Filtros en el teléfono */}
        <Skeleton className="h-11 w-full rounded-3xl md:h-9 md:w-64" />
        <div className="flex w-full items-center gap-2 md:contents">
          <Skeleton className="h-11 flex-1 rounded-3xl md:h-9 md:w-52 md:flex-none" />
          <Skeleton className="h-11 w-28 rounded-3xl md:hidden" />
        </div>
        <div className="hidden gap-2 md:contents">
          <Skeleton className="h-8 w-28 rounded-3xl" />
          <Skeleton className="h-8 w-32 rounded-3xl" />
          <Skeleton className="h-8 w-28 rounded-3xl" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <CardSkeleton className="h-24" />
        <CardSkeleton className="h-24" />
        <CardSkeleton className="h-24" />
      </div>
      <CardSkeleton className="h-96" />
    </>
  )
}
