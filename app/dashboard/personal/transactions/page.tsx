import { Suspense } from "react"
import { Skeleton } from "@heroui/react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CardSkeleton } from "@/components/dashboard/card-skeleton"
import { getAccountBalances } from "@/features/accounts/queries"
import { getCategories } from "@/features/categories/queries"
import {
  NoFilteredTransactions,
  NoTransactions
} from "@/features/transactions/components/transactions-empty"
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
  getTransactions,
  hasAnyLedgerEntries
} from "@/features/transactions/queries"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { shiftMonth } from "@/libs/dates"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Movimientos",
  path: TRANSACTIONS_PATH,
  noindex: true
})

type TransactionsPageProps = PageProps<"/dashboard/personal/transactions">

function monthLabel(month: string) {
  const label = format(new Date(`${month}-01T12:00:00`), "MMMM yyyy", {
    locale: es
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// El título lo pone el header del dashboard. "Registrar movimiento" también
// vive allí: la página no lo repite
export default function TransactionsPage({
  searchParams
}: TransactionsPageProps) {
  return (
    <section
      aria-label="Movimientos"
      className="flex flex-1 flex-col gap-4"
    >
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
  const query = await searchParams
  const workspace = await getPersonalWorkspace()
  // Se parsea tras leer la sesión: el mes por defecto usa la fecha de hoy, y
  // new Date() solo se permite después de connection()
  const filters = parseTransactionFilters(query)
  const isAllMonths = filters.month === "all"
  const [categories, accounts, { rows, count }, totals, previousTotals] =
    await Promise.all([
      getCategories(workspace.id),
      getAccountBalances(workspace.id),
      getTransactions(workspace.id, filters),
      getTransactionTotals(workspace.id, filters),
      // Mismos filtros en el mes anterior, para el badge de las KPI
      isAllMonths
        ? null
        : getTransactionTotals(workspace.id, {
            ...filters,
            month: shiftMonth(filters.month, -1)
          })
    ])
  const previous =
    previousTotals && (previousTotals.income || previousTotals.expense)
      ? previousTotals
      : null
  const hasExtraFilters = Boolean(
    filters.type || filters.categoryId || filters.accountId || filters.q
  )
  const scope = `${isAllMonths ? "Todos los meses" : monthLabel(filters.month)}${hasExtraFilters ? " · con filtros" : ""}`
  // Solo se consulta cuando los filtros no devuelven nada
  const isEmptyWorkspace =
    rows.length === 0 && !(await hasAnyLedgerEntries(workspace.id))

  if (isEmptyWorkspace) {
    return (
      <NoTransactions
        workspaceId={workspace.id}
        categories={categories}
        accounts={accounts}
      />
    )
  }

  return (
    <>
      {/* Una barra: búsqueda, mes y filtros pill. Importar, Categorías y
          Verificar están en "Más" del header */}
      <div className="flex flex-wrap items-start gap-2">
        <TransactionsFilters
          filters={filters}
          categories={categories}
          accounts={accounts}
        />
      </div>
      <TransactionsTotals
        totals={totals}
        previous={previous}
        currency={workspace.currency}
        caption={scope}
      />
      <p
        role="status"
        className="sr-only"
      >
        {count === 1 ? "1 movimiento" : `${count} movimientos`}
      </p>
      {rows.length > 0 ? (
        <TransactionsTable
          workspaceId={workspace.id}
          rows={rows}
          categories={categories}
          accounts={accounts}
          currency={workspace.currency}
          canReorder={!filters.q}
        />
      ) : (
        <NoFilteredTransactions filters={filters} />
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
      <div className="flex flex-wrap gap-2">
        {/* Mismo orden que los filtros: buscador; mes + Filtros en el teléfono */}
        <Skeleton className="h-11 w-full rounded-3xl md:min-w-72 md:flex-1 md:basis-72" />
        <Skeleton className="h-11 flex-1 rounded-3xl md:w-52 md:flex-none" />
        <Skeleton className="h-11 w-28 rounded-3xl md:hidden" />
        <Skeleton className="h-11 w-11 rounded-3xl sm:w-28" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <CardSkeleton className="h-24" />
        <CardSkeleton className="h-24" />
        <CardSkeleton className="h-24" />
      </div>
      <CardSkeleton className="h-96" />
    </>
  )
}
