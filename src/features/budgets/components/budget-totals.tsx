import { Card, CardDescription, CardHeader, CardTitle, cn } from "@heroui/react"
import { Amount } from "@/components/dashboard/amount"
import type { BudgetProgress } from "../queries"

interface BudgetTotalsProps {
  /** Solo filas con presupuesto: así restante = presupuestado − gastado */
  budgets: BudgetProgress[]
  currency: string
}

export function BudgetTotals({ budgets, currency }: BudgetTotalsProps) {
  const budgeted = budgets.reduce(
    (sum, row) => sum + (row.budgetAmount ?? 0),
    0
  )
  const spent = budgets.reduce((sum, row) => sum + row.spent, 0)
  const remaining = budgeted - spent

  const items = [
    { label: "Presupuestado", value: budgeted, className: undefined },
    { label: "Gastado", value: spent, className: undefined },
    {
      label: "Restante",
      value: remaining,
      className: remaining < 0 ? "text-(--expense)" : undefined
    }
  ]

  return (
    <div
      className="grid gap-4 sm:grid-cols-3"
      data-tour="budgets-totals"
    >
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
              <Amount
                value={item.value}
                currency={currency}
              />
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
