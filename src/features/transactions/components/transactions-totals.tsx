import { cn } from "cn"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { formatCurrency } from "@/libs/format"
import type { TransactionTotals } from "../queries"

interface TransactionsTotalsProps {
  totals: TransactionTotals
  currency: string
}

export function TransactionsTotals({
  totals,
  currency
}: TransactionsTotalsProps) {
  const items = [
    {
      label: "Ingresos",
      value: totals.income,
      className: "text-emerald-600 dark:text-emerald-400"
    },
    {
      label: "Gastos",
      value: totals.expense,
      className: "text-rose-600 dark:text-rose-400"
    },
    {
      label: "Balance",
      value: totals.balance,
      className:
        totals.balance < 0 ? "text-rose-600 dark:text-rose-400" : undefined
    }
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader>
            <CardDescription>{item.label}</CardDescription>
            <CardTitle
              className={cn(
                "text-2xl font-semibold tabular-nums",
                item.className
              )}
            >
              {formatCurrency(item.value, currency)}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
