import type { Route } from "next"
import Link from "next/link"
import { Amount } from "@/components/dashboard/amount"
import {
  ScrollTable,
  ScrollTableSkeleton
} from "@/components/dashboard/scroll-table"
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
import { percentShares } from "../metrics"
import type { ReportParams } from "../period"
import type { CategoryTotal } from "../queries"

const PERCENT = new Intl.NumberFormat("es-CO", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
})

interface CategorySummaryTableProps {
  totals: CategoryTotal[]
  params: ReportParams
  currency: string
  /** Ruta de Movimientos del espacio */
  transactionsPath?: string
}

// Movimientos solo filtra por mes: con otro periodo el enlace abre todos
export function CategorySummaryTable({
  totals,
  params,
  currency,
  transactionsPath = TRANSACTIONS_PATH
}: CategorySummaryTableProps) {
  const month = params.period === "month" && params.value ? params.value : "all"
  const shares = percentShares(totals.map((row) => row.total))

  return (
    <ScrollTable minWidth="34rem">
      <Table aria-label="Resumen por categoría">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Categoría</TableHead>
            <TableHead className="text-end">Total</TableHead>
            <TableHead className="text-end">% del total</TableHead>
            <TableHead className="text-end">Movimientos</TableHead>
            <TableHead className="text-end">Promedio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {totals.map((row, index) => {
            const href = `${transactionsPath}?${buildFiltersQuery({
              month,
              type: params.type,
              categoryId: row.categoryId,
              page: 1
            })}` as Route

            return (
              // El enlace cubre toda la fila con un pseudo-elemento
              <TableRow
                key={row.categoryId}
                className="relative"
              >
                <TableCell>
                  <Link
                    href={href}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md outline-none after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <CategoryBadge
                      name={row.name}
                      icon={row.icon}
                      color={row.color}
                    />
                    {row.archived && (
                      <span className="text-xs text-muted-foreground">
                        (archivada)
                      </span>
                    )}
                  </Link>
                </TableCell>
                <TableCell className="text-end font-medium tabular-nums">
                  <Amount
                    value={row.total}
                    currency={currency}
                  />
                </TableCell>
                <TableCell className="text-end text-muted-foreground tabular-nums">
                  {PERCENT.format(shares[index] / 100)}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {row.txCount}
                </TableCell>
                <TableCell className="text-end text-muted-foreground tabular-nums">
                  <Amount
                    value={row.total / row.txCount}
                    currency={currency}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </ScrollTable>
  )
}

/** Hueco de la tabla de categorías: cinco columnas, monto al final */
export function CategorySummaryTableSkeleton() {
  return (
    <ScrollTableSkeleton
      columns={5}
      rows={5}
      minWidth="34rem"
      className="bg-transparent px-0 shadow-none"
    />
  )
}
