import type { Route } from "next"
import Link from "next/link"
import { Table } from "@heroui/react"
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
    <div className="rounded-xl border">
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Resumen por categoría">
            <Table.Header>
              <Table.Column isRowHeader>Categoría</Table.Column>
              <Table.Column className="text-end">Total</Table.Column>
              <Table.Column className="text-end">% del total</Table.Column>
              <Table.Column className="text-end">Movimientos</Table.Column>
              <Table.Column className="text-end">Promedio</Table.Column>
            </Table.Header>
            <Table.Body>
              {totals.map((row, index) => {
                const href = `${transactionsPath}?${buildFiltersQuery({
                  month,
                  type: params.type,
                  categoryId: row.categoryId,
                  page: 1
                })}` as Route

                return (
                  // El enlace cubre toda la fila con un pseudo-elemento
                  <Table.Row
                    key={row.categoryId}
                    className="relative"
                  >
                    <Table.Cell>
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
                          <span className="text-xs text-muted">
                            (archivada)
                          </span>
                        )}
                      </Link>
                    </Table.Cell>
                    <Table.Cell className="text-end font-medium tabular-nums">
                      {formatCurrency(row.total, currency)}
                    </Table.Cell>
                    <Table.Cell className="text-end text-muted tabular-nums">
                      {PERCENT.format(shares[index] / 100)}
                    </Table.Cell>
                    <Table.Cell className="text-end tabular-nums">
                      {row.txCount}
                    </Table.Cell>
                    <Table.Cell className="text-end text-muted tabular-nums">
                      {formatCurrency(row.total / row.txCount, currency)}
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
  )
}
