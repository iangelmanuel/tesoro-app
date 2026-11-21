"use client"

import type { Route } from "next"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ArrowDownLeft, ArrowUpRight, List } from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import {
  type RowAction,
  RowContextMenu
} from "@/components/dashboard/data/row-actions"
import {
  ScrollTable,
  ScrollTableSkeleton
} from "@/components/dashboard/data/scroll-table"
import { SURFACE_LIST } from "@/components/dashboard/data/surface"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { NEGATIVE } from "@/features/reports/change"
import {
  type LedgerFilterType,
  buildFiltersQuery
} from "@/features/transactions/filters"
import { workspaceTransactionsPath } from "@/features/workspaces/paths"
import { cn } from "@/libs/cn"
import type { CashFlowMonth } from "../queries"

const TABLE_SURFACE = cn(SURFACE_LIST, "divide-y-0 px-2")
const MIN_WIDTH = "40rem"

// `month` es una fecha de Postgres: se arma en local para que no se corra
function monthLabel(month: string) {
  const [year, monthIndex] = month.split("-").map(Number)
  return format(new Date(year, monthIndex - 1, 1), "MMMM yyyy", { locale: es })
}

interface CashFlowTableProps {
  months: CashFlowMonth[]
  currency: string
  /** Empresa del flujo: arma los enlaces a sus Movimientos */
  workspaceId: string
}

/**
 * Entradas, salidas, neto y saldo en cuentas al cierre, mes a mes. Cada
 * fila tiene menú contextual (clic derecho o pulsación larga) que abre
 * Movimientos de la empresa filtrado por ese mes y, si se elige, por tipo
 */
export function CashFlowTable({
  months,
  currency,
  workspaceId
}: CashFlowTableProps) {
  const router = useRouter()
  const transactionsPath = workspaceTransactionsPath({
    id: workspaceId,
    type: "business"
  })

  // Mismos parámetros que lee Movimientos (filters.ts): ?month=YYYY-MM y
  // ?type=income|expense
  function openTransactions(month: string, type?: LedgerFilterType) {
    const query = buildFiltersQuery({ month, type, page: 1 })
    router.push(`${transactionsPath}?${query}` as Route)
  }

  return (
    <ScrollTable
      minWidth={MIN_WIDTH}
      className={TABLE_SURFACE}
    >
      <Table aria-label="Flujo de caja por mes">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col">Mes</TableHead>
            <TableHead
              scope="col"
              className="text-end"
            >
              Entradas
            </TableHead>
            <TableHead
              scope="col"
              className="text-end"
            >
              Salidas
            </TableHead>
            <TableHead
              scope="col"
              className="text-end"
            >
              Neto
            </TableHead>
            <TableHead
              scope="col"
              className="text-end"
            >
              Saldo al cierre
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {months.map((row) => {
            const month = row.month.slice(0, 7)
            const label = monthLabel(row.month)
            const actions: RowAction[] = [
              {
                id: "transactions",
                label: "Ver movimientos del mes",
                icon: <List />,
                onAction: () => openTransactions(month)
              },
              {
                id: "income",
                label: "Ver entradas del mes",
                icon: <ArrowDownLeft />,
                onAction: () => openTransactions(month, "income")
              },
              {
                id: "expense",
                label: "Ver salidas del mes",
                icon: <ArrowUpRight />,
                onAction: () => openTransactions(month, "expense")
              }
            ]

            return (
              <RowContextMenu
                key={row.month}
                label={label}
                actions={actions}
              >
                <TableRow>
                  <TableCell className="first-letter:uppercase">
                    {label}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    <Amount
                      value={row.inflow}
                      currency={currency}
                    />
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    <Amount
                      value={row.outflow}
                      currency={currency}
                    />
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-end font-medium tabular-nums",
                      row.net < 0 && NEGATIVE
                    )}
                  >
                    <Amount
                      value={row.net}
                      currency={currency}
                    />
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-end tabular-nums",
                      row.closingBalance < 0 && NEGATIVE
                    )}
                  >
                    <Amount
                      value={row.closingBalance}
                      currency={currency}
                    />
                  </TableCell>
                </TableRow>
              </RowContextMenu>
            )
          })}
        </TableBody>
      </Table>
    </ScrollTable>
  )
}

/** Tabla mes a mes mientras carga: misma superficie y columnas */
export function CashFlowTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ScrollTableSkeleton
      columns={5}
      rows={rows}
      minWidth={MIN_WIDTH}
    />
  )
}
