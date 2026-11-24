import {
  CardHeading,
  CardHeadingSkeleton
} from "@/components/dashboard/data/card-heading"
import {
  ScrollTable,
  ScrollTableSkeleton
} from "@/components/dashboard/data/scroll-table"
import { CARD } from "@/components/dashboard/data/surface"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import {
  TRANSACTIONS_PATH,
  buildFiltersQuery
} from "@/features/transactions/filters"
import type { TransactionWithCategory } from "@/features/transactions/types"
import { cn } from "@/libs/cn"
import { formatCurrency, formatDate } from "@/libs/format"

// Los últimos movimientos pueden ser de meses anteriores: "Ver todos" abre
// Movimientos con todos los meses
const ALL_MONTHS_QUERY = buildFiltersQuery({ month: "all", page: 1 })
const MIN_WIDTH = "36rem"

interface RecentTransactionsProps {
  rows: TransactionWithCategory[]
  currency: string
  /** Ruta de Movimientos del espacio */
  transactionsPath?: string
}

export function RecentTransactions({
  rows,
  currency,
  transactionsPath = TRANSACTIONS_PATH
}: RecentTransactionsProps) {
  return (
    <section
      aria-label="Últimos movimientos"
      className={CARD}
      data-tour="summary-recent"
    >
      <CardHeading
        title="Últimos movimientos"
        href={`${transactionsPath}?${ALL_MONTHS_QUERY}`}
        linkLabel="Ver todos"
        linkContext="los movimientos"
      />
      <ScrollTable minWidth={MIN_WIDTH}>
        <Table aria-label="Últimos movimientos">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-32">Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-end">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((transaction) => {
              const isIncome = transaction.type === "income"
              return (
                <TableRow key={transaction.id}>
                  <TableCell className="text-muted-foreground">
                    {formatDate(transaction.occurred_on)}
                  </TableCell>
                  <TableCell className="max-w-64 min-w-44 whitespace-normal">
                    <p
                      title={transaction.description}
                      className="line-clamp-3 font-medium break-words"
                    >
                      {transaction.description}
                    </p>
                  </TableCell>
                  <TableCell>
                    <CategoryBadge
                      name={transaction.category.name}
                      icon={transaction.category.icon}
                      color={transaction.category.color}
                    />
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-end font-medium tabular-nums",
                      isIncome ? "text-(--income)" : "text-(--expense)"
                    )}
                  >
                    {/* El signo se lee: "más" o "menos" y el monto completo */}
                    <span aria-hidden="true">{isIncome ? "+" : "−"}</span>
                    <span className="sr-only">
                      {isIncome ? "más " : "menos "}
                    </span>
                    {formatCurrency(transaction.amount, currency)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </ScrollTable>
    </section>
  )
}

/** Últimos movimientos mientras cargan: cabecera y cinco filas */
export function RecentTransactionsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className={CARD}>
      <CardHeadingSkeleton />
      <ScrollTableSkeleton
        columns={4}
        rows={rows}
        minWidth={MIN_WIDTH}
        className="bg-transparent px-0 shadow-none"
      />
    </div>
  )
}
