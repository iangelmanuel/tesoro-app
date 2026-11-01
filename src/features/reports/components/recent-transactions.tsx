import type { Route } from "next"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  buttonVariants,
  cn
} from "@heroui/react"
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
      <div className="flex items-start justify-between gap-2">
        <CardHeader>
          <CardTitle>Últimos movimientos</CardTitle>
          <CardDescription>Los {rows.length} más recientes</CardDescription>
        </CardHeader>
        <div className="shrink-0">
          <Link
            href={`${transactionsPath}?${ALL_MONTHS_QUERY}` as Route}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Ver todos
          </Link>
        </div>
      </div>
      <CardContent>
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Últimos movimientos">
              <Table.Header>
                <Table.Column
                  isRowHeader
                  className="w-32"
                >
                  Fecha
                </Table.Column>
                <Table.Column>Descripción</Table.Column>
                <Table.Column>Categoría</Table.Column>
                <Table.Column className="text-end">Monto</Table.Column>
              </Table.Header>
              <Table.Body>
                {rows.map((transaction) => (
                  <Table.Row key={transaction.id}>
                    <Table.Cell className="text-muted">
                      {formatDate(transaction.occurred_on)}
                    </Table.Cell>
                    <Table.Cell className="max-w-64">
                      <p className="truncate font-medium">
                        {transaction.description}
                      </p>
                    </Table.Cell>
                    <Table.Cell>
                      <CategoryBadge
                        name={transaction.category.name}
                        icon={transaction.category.icon}
                        color={transaction.category.color}
                      />
                    </Table.Cell>
                    <Table.Cell
                      className={cn(
                        "text-right font-medium tabular-nums",
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
      </CardContent>
    </Card>
  )
}
