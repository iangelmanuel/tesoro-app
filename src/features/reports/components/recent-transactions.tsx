import { Card, CardContent, Table, cn } from "@heroui/react"
import { CardHeading } from "@/components/dashboard/card-heading"
import { ScrollTable } from "@/components/dashboard/scroll-table"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import {
  TRANSACTIONS_PATH,
  buildFiltersQuery
} from "@/features/transactions/filters"
import type { TransactionWithCategory } from "@/features/transactions/queries"
import { formatCurrency, formatDate } from "@/libs/format"

// Los últimos movimientos pueden ser de meses anteriores: "Ver todos" abre
// Movimientos con todos los meses
const ALL_MONTHS_QUERY = buildFiltersQuery({ month: "all", page: 1 })

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
    <Card>
      <CardHeading
        title="Últimos movimientos"
        href={`${transactionsPath}?${ALL_MONTHS_QUERY}`}
        linkLabel="Ver todos"
        linkContext="los movimientos"
      />
      <CardContent>
        <ScrollTable minWidth="36rem">
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Últimos movimientos">
                <Table.Header>
                  <Table.Column className="w-32 whitespace-nowrap">
                    Fecha
                  </Table.Column>
                  <Table.Column isRowHeader>Descripción</Table.Column>
                  <Table.Column className="whitespace-nowrap">
                    Categoría
                  </Table.Column>
                  <Table.Column className="text-end whitespace-nowrap">
                    Monto
                  </Table.Column>
                </Table.Header>
                <Table.Body>
                  {rows.map((transaction) => (
                    <Table.Row key={transaction.id}>
                      <Table.Cell className="whitespace-nowrap text-muted">
                        {formatDate(transaction.occurred_on)}
                      </Table.Cell>
                      <Table.Cell className="max-w-64 min-w-44">
                        <p
                          title={transaction.description}
                          className="line-clamp-3 font-medium break-words"
                        >
                          {transaction.description}
                        </p>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        <CategoryBadge
                          name={transaction.category.name}
                          icon={transaction.category.icon}
                          color={transaction.category.color}
                        />
                      </Table.Cell>
                      <Table.Cell
                        className={cn(
                          "text-right font-medium whitespace-nowrap tabular-nums",
                          transaction.type === "income"
                            ? "text-(--income)"
                            : "text-(--expense)"
                        )}
                      >
                        {transaction.type === "income" ? "+" : "−"}
                        {formatCurrency(transaction.amount, currency)}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </ScrollTable>
      </CardContent>
    </Card>
  )
}
