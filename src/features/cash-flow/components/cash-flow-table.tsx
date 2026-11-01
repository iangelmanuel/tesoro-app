import { Table, cn } from "@heroui/react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DataRow, DataRows } from "@/components/dashboard/data-rows"
import { NEGATIVE } from "@/features/reports/change"
import { formatCurrency } from "@/libs/format"
import type { CashFlowMonth } from "../queries"

// `month` es una fecha de Postgres: se arma en local para que no se corra
function monthLabel(month: string) {
  const [year, monthIndex] = month.split("-").map(Number)
  return format(new Date(year, monthIndex - 1, 1), "MMMM yyyy", { locale: es })
}

interface CashFlowTableProps {
  months: CashFlowMonth[]
  currency: string
}

/** Entradas, salidas, neto y saldo en cuentas al cierre, mes a mes */
export function CashFlowTable({ months, currency }: CashFlowTableProps) {
  return (
    <>
      {/* < 768 px: una tarjeta por mes; la tabla va en display: none */}
      <DataRows
        boxed
        label="Flujo de caja por mes"
      >
        {months.map((row) => (
          <DataRow
            boxed
            key={row.month}
            title={
              <span className="first-letter:uppercase">
                {monthLabel(row.month)}
              </span>
            }
            value={`Neto ${formatCurrency(row.net, currency)}`}
            valueClassName={cn(row.net < 0 && NEGATIVE)}
            meta={
              <>
                <span className="whitespace-nowrap tabular-nums">
                  Entradas {formatCurrency(row.inflow, currency)}
                </span>
                <span className="whitespace-nowrap tabular-nums">
                  Salidas {formatCurrency(row.outflow, currency)}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap tabular-nums",
                    row.closingBalance < 0 && NEGATIVE
                  )}
                >
                  Saldo {formatCurrency(row.closingBalance, currency)}
                </span>
              </>
            }
          />
        ))}
      </DataRows>
      <div className="hidden rounded-xl border md:block">
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Flujo de caja por mes">
              <Table.Header>
                <Table.Column isRowHeader>Mes</Table.Column>
                <Table.Column className="text-end">Entradas</Table.Column>
                <Table.Column className="text-end">Salidas</Table.Column>
                <Table.Column className="text-end">Neto</Table.Column>
                <Table.Column className="text-end">
                  Saldo al cierre
                </Table.Column>
              </Table.Header>
              <Table.Body>
                {months.map((row) => (
                  <Table.Row key={row.month}>
                    <Table.Cell className="first-letter:uppercase">
                      {monthLabel(row.month)}
                    </Table.Cell>
                    <Table.Cell className="text-end tabular-nums">
                      {formatCurrency(row.inflow, currency)}
                    </Table.Cell>
                    <Table.Cell className="text-end tabular-nums">
                      {formatCurrency(row.outflow, currency)}
                    </Table.Cell>
                    <Table.Cell
                      className={cn(
                        "text-right font-medium tabular-nums",
                        row.net < 0 && NEGATIVE
                      )}
                    >
                      {formatCurrency(row.net, currency)}
                    </Table.Cell>
                    <Table.Cell
                      className={cn(
                        "text-right tabular-nums",
                        row.closingBalance < 0 && NEGATIVE
                      )}
                    >
                      {formatCurrency(row.closingBalance, currency)}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </div>
    </>
  )
}
