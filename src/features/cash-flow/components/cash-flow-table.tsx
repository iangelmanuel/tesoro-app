import { Table, cn } from "@heroui/react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Amount } from "@/components/dashboard/amount"
import { ScrollTable } from "@/components/dashboard/scroll-table"
import { NEGATIVE } from "@/features/reports/change"
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
    <ScrollTable minWidth="40rem">
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Flujo de caja por mes">
            <Table.Header>
              <Table.Column isRowHeader>Mes</Table.Column>
              <Table.Column className="text-end whitespace-nowrap">
                Entradas
              </Table.Column>
              <Table.Column className="text-end whitespace-nowrap">
                Salidas
              </Table.Column>
              <Table.Column className="text-end whitespace-nowrap">
                Neto
              </Table.Column>
              <Table.Column className="text-end whitespace-nowrap">
                Saldo al cierre
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {months.map((row) => (
                <Table.Row key={row.month}>
                  <Table.Cell className="whitespace-nowrap first-letter:uppercase">
                    {monthLabel(row.month)}
                  </Table.Cell>
                  <Table.Cell className="text-end whitespace-nowrap tabular-nums">
                    <Amount
                      value={row.inflow}
                      currency={currency}
                    />
                  </Table.Cell>
                  <Table.Cell className="text-end whitespace-nowrap tabular-nums">
                    <Amount
                      value={row.outflow}
                      currency={currency}
                    />
                  </Table.Cell>
                  <Table.Cell
                    className={cn(
                      "text-right font-medium whitespace-nowrap tabular-nums",
                      row.net < 0 && NEGATIVE
                    )}
                  >
                    <Amount
                      value={row.net}
                      currency={currency}
                    />
                  </Table.Cell>
                  <Table.Cell
                    className={cn(
                      "text-right whitespace-nowrap tabular-nums",
                      row.closingBalance < 0 && NEGATIVE
                    )}
                  >
                    <Amount
                      value={row.closingBalance}
                      currency={currency}
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </ScrollTable>
  )
}
