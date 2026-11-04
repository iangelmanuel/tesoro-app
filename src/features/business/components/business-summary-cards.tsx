import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  cn
} from "@heroui/react"
import { Amount } from "@/components/dashboard/amount"
import {
  EMPTY,
  NEGATIVE,
  PERCENT,
  POSITIVE,
  changeTone,
  formatPercentChange
} from "@/features/reports/change"
import {
  balanceDifference,
  percentChange,
  savingsRate
} from "@/features/reports/metrics"
import type { MonthlyTotal } from "@/features/reports/queries"

interface BusinessSummaryCardsProps {
  /** Totales del mes actual: income = ventas, expense = costos y gastos */
  current: MonthlyTotal
  /** Totales del mes anterior, para la variación */
  previous: MonthlyTotal
  /** Σ saldo a hoy de las cuentas activas */
  accountsBalance: number
  /** "octubre 2026" */
  monthLabel: string
  currency: string
}

/**
 * Ventas, costos y gastos, y utilidad (ventas − costos) del mes con su
 * variación vs. el mes anterior, más margen y saldo en cuentas
 */
export function BusinessSummaryCards({
  current,
  previous,
  accountsBalance,
  monthLabel,
  currency
}: BusinessSummaryCardsProps) {
  const salesChange = percentChange(current.income, previous.income)
  const costsChange = percentChange(current.expense, previous.expense)
  const profitChange = balanceDifference(current.balance, previous.balance)
  // Utilidad / ventas × 100: la misma cuenta que la tasa de ahorro de Personal
  const margin = savingsRate(current.income, current.expense)

  const main = [
    {
      title: "Ventas",
      value: (
        <Amount
          value={current.income}
          currency={currency}
        />
      ),
      change: formatPercentChange(salesChange),
      changeClassName: changeTone(salesChange)
    },
    {
      title: "Costos y gastos",
      value: (
        <Amount
          value={current.expense}
          currency={currency}
        />
      ),
      change: formatPercentChange(costsChange),
      changeClassName: changeTone(costsChange, true)
    },
    {
      title: "Utilidad",
      value: (
        <Amount
          value={current.balance}
          currency={currency}
        />
      ),
      valueClassName: current.balance < 0 ? NEGATIVE : POSITIVE,
      change: (
        <>
          {profitChange > 0 ? "+" : ""}
          <Amount
            value={profitChange}
            currency={currency}
          />
        </>
      ),
      changeClassName: changeTone(profitChange)
    }
  ]

  const secondary = [
    {
      title: "Margen",
      value: margin === null ? EMPTY : PERCENT.format(margin / 100),
      valueClassName: margin !== null && margin < 0 ? NEGATIVE : undefined,
      hint: "Utilidad sobre las ventas del mes"
    },
    {
      title: "Saldo en cuentas",
      value: (
        <Amount
          value={accountsBalance}
          currency={currency}
        />
      ),
      valueClassName: accountsBalance < 0 ? NEGATIVE : undefined,
      hint: "Hoy, en las cuentas activas"
    }
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {main.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardDescription>
                {card.title} ·{" "}
                <span className="first-letter:uppercase">{monthLabel}</span>
              </CardDescription>
              <CardTitle
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  card.valueClassName
                )}
              >
                {card.value}
              </CardTitle>
            </CardHeader>
            <CardFooter className="gap-1 text-sm">
              <span
                className={cn("font-medium tabular-nums", card.changeClassName)}
              >
                {card.change}
              </span>
              <span className="text-muted">vs. mes anterior</span>
            </CardFooter>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {secondary.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardDescription>{card.title}</CardDescription>
              <CardTitle
                className={cn(
                  "text-xl font-semibold tabular-nums",
                  card.valueClassName
                )}
              >
                {card.value}
              </CardTitle>
            </CardHeader>
            <CardFooter className="text-sm text-muted">{card.hint}</CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
