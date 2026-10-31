import { cn } from "cn"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import type { TransactionTotals } from "@/features/transactions/queries"
import { formatCurrency } from "@/libs/format"

interface BusinessSummaryCardsProps {
  /** Totales del mes: income = ventas, expense = costos y gastos */
  totals: TransactionTotals
  /** "octubre 2026" */
  monthLabel: string
  currency: string
}

/** Ventas, costos y gastos, y utilidad (ventas − costos) del mes */
export function BusinessSummaryCards({
  totals,
  monthLabel,
  currency
}: BusinessSummaryCardsProps) {
  const cards = [
    { title: "Ventas", amount: totals.income, tone: "" },
    { title: "Costos y gastos", amount: totals.expense, tone: "" },
    {
      title: "Utilidad",
      amount: totals.balance,
      tone:
        totals.balance < 0
          ? "text-rose-600 dark:text-rose-400"
          : "text-emerald-600 dark:text-emerald-400"
    }
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader>
            <CardDescription>
              {card.title} ·{" "}
              <span className="first-letter:uppercase">{monthLabel}</span>
            </CardDescription>
            <CardTitle
              className={cn("text-2xl font-semibold tabular-nums", card.tone)}
            >
              {formatCurrency(card.amount, currency)}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
