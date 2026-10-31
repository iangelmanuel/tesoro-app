import { cn } from "cn"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import { formatCurrency } from "@/libs/format"
import {
  EMPTY,
  NEGATIVE,
  PERCENT,
  POSITIVE,
  changeTone,
  formatPercentChange,
  formatSignedCurrency
} from "../change"
import {
  balanceDifference,
  dailyAverage,
  monthProgress,
  monthProjection,
  percentChange,
  savingsRate
} from "../metrics"
import type { CategoryTotal, MonthlyTotal } from "../queries"

interface SummaryCardsProps {
  current: MonthlyTotal
  previous: MonthlyTotal
  topCategory: CategoryTotal | null
  accumulatedBalance: number
  /** Hoy en America/Bogota (YYYY-MM-DD) */
  today: string
  currency: string
}

export function SummaryCards({
  current,
  previous,
  topCategory,
  accumulatedBalance,
  today,
  currency
}: SummaryCardsProps) {
  const incomeChange = percentChange(current.income, previous.income)
  const expenseChange = percentChange(current.expense, previous.expense)
  const balanceChange = balanceDifference(current.balance, previous.balance)
  const rate = savingsRate(current.income, current.expense)
  const { daysElapsed, daysInMonth } = monthProgress(today)
  const average = dailyAverage(current.expense, daysElapsed)
  const projection = monthProjection(average, daysInMonth)

  const main = [
    {
      label: "Ingresos",
      value: formatCurrency(current.income, currency),
      valueClassName: POSITIVE,
      change: formatPercentChange(incomeChange),
      changeClassName: changeTone(incomeChange)
    },
    {
      label: "Gastos",
      value: formatCurrency(current.expense, currency),
      valueClassName: NEGATIVE,
      change: formatPercentChange(expenseChange),
      changeClassName: changeTone(expenseChange, true)
    },
    {
      label: "Balance",
      value: formatCurrency(current.balance, currency),
      valueClassName: current.balance < 0 ? NEGATIVE : undefined,
      change: formatSignedCurrency(balanceChange, currency),
      changeClassName: changeTone(balanceChange)
    }
  ]

  const secondary = [
    {
      label: "Tasa de ahorro",
      value: rate === null ? EMPTY : PERCENT.format(rate / 100),
      valueClassName: rate !== null && rate < 0 ? NEGATIVE : undefined,
      hint: "Del ingreso del mes"
    },
    {
      label: "Gasto promedio diario",
      value: formatCurrency(average, currency),
      hint: `${daysElapsed} de ${daysInMonth} días`
    },
    {
      label: "Proyección de gasto",
      value: formatCurrency(projection, currency),
      hint: "Al cierre del mes a este ritmo"
    },
    {
      label: "Balance acumulado",
      value: formatCurrency(accumulatedBalance, currency),
      valueClassName: accumulatedBalance < 0 ? NEGATIVE : undefined,
      hint: "Todos tus movimientos"
    },
    {
      label: "Movimientos del mes",
      value: String(current.txCount),
      hint: "Ingresos y gastos"
    }
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {main.map((item) => (
          <Card key={item.label}>
            <CardHeader>
              <CardDescription>{item.label}</CardDescription>
              <CardTitle
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  item.valueClassName
                )}
              >
                {item.value}
              </CardTitle>
            </CardHeader>
            <CardFooter className="gap-1 text-sm">
              <span
                className={cn("font-medium tabular-nums", item.changeClassName)}
              >
                {item.change}
              </span>
              <span className="text-muted-foreground">vs. mes anterior</span>
            </CardFooter>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {secondary.slice(0, 3).map((item) => (
          <SecondaryCard
            key={item.label}
            {...item}
          />
        ))}
        <Card>
          <CardHeader>
            <CardDescription>Categoría de mayor gasto</CardDescription>
            <CardTitle className="text-xl font-semibold">
              {topCategory ? (
                <CategoryBadge
                  name={topCategory.name}
                  icon={topCategory.icon}
                  color={topCategory.color}
                />
              ) : (
                EMPTY
              )}
            </CardTitle>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground tabular-nums">
            {topCategory
              ? formatCurrency(topCategory.total, currency)
              : "Sin gastos este mes"}
          </CardFooter>
        </Card>
        {secondary.slice(3).map((item) => (
          <SecondaryCard
            key={item.label}
            {...item}
          />
        ))}
      </div>
    </div>
  )
}

function SecondaryCard({
  label,
  value,
  valueClassName,
  hint
}: {
  label: string
  value: string
  valueClassName?: string
  hint: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn("text-xl font-semibold tabular-nums", valueClassName)}
        >
          {value}
        </CardTitle>
      </CardHeader>
      <CardFooter className="text-sm text-muted-foreground">{hint}</CardFooter>
    </Card>
  )
}
