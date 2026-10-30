import type { Route } from "next"
import Link from "next/link"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
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
import type { TransactionWithCategory } from "@/features/transactions/queries"
import { formatCurrency, formatDate } from "@/libs/format"

// Los últimos movimientos pueden ser de meses anteriores: "Ver todos" abre
// Movimientos con todos los meses
const ALL_TRANSACTIONS_HREF =
  `${TRANSACTIONS_PATH}?${buildFiltersQuery({ month: "all", page: 1 })}` as Route

interface RecentTransactionsProps {
  rows: TransactionWithCategory[]
  currency: string
}

export function RecentTransactions({
  rows,
  currency
}: RecentTransactionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimos movimientos</CardTitle>
        <CardDescription>Los {rows.length} más recientes</CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <Link href={ALL_TRANSACTIONS_HREF}>Ver todos</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="text-muted-foreground">
                  {formatDate(transaction.occurred_on)}
                </TableCell>
                <TableCell className="max-w-64">
                  <p className="truncate font-medium">
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
                    "text-right font-medium tabular-nums",
                    transaction.type === "income"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {transaction.type === "income" ? "+" : "−"}
                  {formatCurrency(transaction.amount, currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
