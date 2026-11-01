import { Table, cn } from "@heroui/react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
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
    <div className="rounded-xl border">
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Flujo de caja por mes">
            <Table.Header>
              <Table.Column isRowHeader>Mes</Table.Column>
              <Table.Column className="text-end">Entradas</Table.Column>
              <Table.Column className="text-end">Salidas</Table.Column>
              <Table.Column className="text-end">Neto</Table.Column>
              <Table.Column className="text-end">Saldo al cierre</Table.Column>
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
  )
}
