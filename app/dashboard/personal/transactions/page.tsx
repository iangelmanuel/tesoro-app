import { Suspense } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CategoriesSheet } from "@/features/categories/components/categories-sheet"
import { getCategories } from "@/features/categories/queries"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import { TransactionsFilters } from "@/features/transactions/components/transactions-filters"
import { TransactionsPagination } from "@/features/transactions/components/transactions-pagination"
import { TransactionsTable } from "@/features/transactions/components/transactions-table"
import { TransactionsTotals } from "@/features/transactions/components/transactions-totals"
import {
  TRANSACTIONS_PATH,
  parseTransactionFilters
} from "@/features/transactions/filters"
import {
  getTransactionTotals,
  getTransactions
} from "@/features/transactions/queries"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Movimientos",
  path: TRANSACTIONS_PATH,
  noindex: true
})

type TransactionsPageProps = PageProps<"/dashboard/personal/transactions">

export default function TransactionsPage({
  searchParams
}: TransactionsPageProps) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>
        <p className="text-sm text-muted-foreground">
          Tus ingresos y gastos registrados.
        </p>
      </header>
      {/* searchParams y la sesión son dinámicos: van dentro de Suspense */}
      <Suspense fallback={<TransactionsSkeleton />}>
        <TransactionsContent searchParams={searchParams} />
      </Suspense>
    </section>
  )
}

async function TransactionsContent({
  searchParams
}: Pick<TransactionsPageProps, "searchParams">) {
  const filters = parseTransactionFilters(await searchParams)
  const workspace = await getPersonalWorkspace()
  const [categories, { rows, count }, totals] = await Promise.all([
    getCategories(workspace.id),
    getTransactions(workspace.id, filters),
    getTransactionTotals(workspace.id, filters)
  ])

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <TransactionDialog
          categories={categories}
          trigger={
            <Button>
              <Plus data-icon="inline-start" />
              Nuevo movimiento
            </Button>
          }
        />
        <CategoriesSheet categories={categories} />
      </div>

      <TransactionsFilters
        filters={filters}
        categories={categories}
      />
      <TransactionsTotals
        totals={totals}
        currency={workspace.currency}
      />

      {rows.length > 0 ? (
        <TransactionsTable
          rows={rows}
          categories={categories}
          currency={workspace.currency}
        />
      ) : (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No hay movimientos.
        </p>
      )}

      <TransactionsPagination
        filters={filters}
        count={count}
      />
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
