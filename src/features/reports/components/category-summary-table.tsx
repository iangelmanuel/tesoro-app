import type { Route } from "next"
import Link from "next/link"
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
import { formatCurrency } from "@/libs/format"
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
}

// Movimientos solo filtra por mes: con otro periodo el enlace abre todos
export function CategorySummaryTable({
  totals,
  params,
  currency
}: CategorySummaryTableProps) {
  const month = params.period === "month" && params.value ? params.value : "all"
  const shares = percentShares(totals.map((row) => row.total))

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Categoría</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">% del total</TableHead>
            <TableHead className="text-right">Movimientos</TableHead>
            <TableHead className="text-right">Promedio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {totals.map((row, index) => {
            const href = `${TRANSACTIONS_PATH}?${buildFiltersQuery({
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
                    className="inline-flex items-center gap-2 rounded-sm after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-ring"
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
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(row.total, currency)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {PERCENT.format(shares[index] / 100)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.txCount}
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {formatCurrency(row.total / row.txCount, currency)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
