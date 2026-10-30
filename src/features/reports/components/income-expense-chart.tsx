"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip
} from "@/components/ui/chart"
import { formatCurrency } from "@/libs/format"
import type { MonthlyTotal } from "../queries"
import { ChartDataTable } from "./chart-data-table"
import { CurrencyTooltipContent } from "./currency-tooltip"

const CHART_CONFIG = {
  income: { label: "Ingresos", color: "var(--income)" },
  expense: { label: "Gastos", color: "var(--expense)" },
  balance: { label: "Balance", color: "var(--balance)" }
} satisfies ChartConfig

const LABELS = {
  income: "Ingresos",
  expense: "Gastos",
  balance: "Balance"
}

const COMPACT = new Intl.NumberFormat("es-CO", {
  notation: "compact",
  maximumFractionDigits: 1
})

// `month` es una fecha de Postgres: se arma en local para que no se corra
function toDate(month: string) {
  const [year, monthIndex] = month.split("-").map(Number)
  return new Date(year, monthIndex - 1, 1)
}

function monthLabel(month: string) {
  return format(toDate(month), "MMMM yyyy", { locale: es })
}

interface IncomeExpenseChartProps {
  data: MonthlyTotal[]
  currency: string
  /** Agrega la línea de balance sobre las barras */
  showBalance?: boolean
  className?: string
}

export function IncomeExpenseChart({
  data,
  currency,
  showBalance = false,
  className
}: IncomeExpenseChartProps) {
  const sameYear =
    data.length > 0 &&
    data[0].month.slice(0, 4) === data.at(-1)?.month.slice(0, 4)
  const tickFormat = sameYear ? "MMM" : "MMM yy"
  const range =
    data.length > 0
      ? `de ${monthLabel(data[0].month)} a ${monthLabel(data.at(-1)!.month)}`
      : ""
  const description = `Ingresos y gastos${showBalance ? " con balance" : ""} por mes ${range}`

  return (
    <>
      <ChartContainer
        config={CHART_CONFIG}
        className={className}
        role="figure"
        aria-label={description}
      >
        <ComposedChart
          data={data}
          accessibilityLayer
          margin={{ left: 4, right: 4 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(month: string) =>
              format(toDate(month), tickFormat, { locale: es })
            }
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(value: number) => COMPACT.format(value)}
          />
          <ChartTooltip
            content={
              <CurrencyTooltipContent
                currency={currency}
                labels={LABELS}
                labelFormatter={(_, payload) =>
                  payload[0] ? monthLabel(String(payload[0].payload.month)) : ""
                }
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="income"
            fill="var(--color-income)"
            radius={4}
          />
          <Bar
            dataKey="expense"
            fill="var(--color-expense)"
            radius={4}
          />
          {showBalance && (
            <Line
              dataKey="balance"
              type="monotone"
              stroke="var(--color-balance)"
              strokeWidth={2}
              dot={{ fill: "var(--color-balance)" }}
            />
          )}
        </ComposedChart>
      </ChartContainer>
      <ChartDataTable
        caption={description}
        headers={[
          "Mes",
          "Ingresos",
          "Gastos",
          ...(showBalance ? ["Balance"] : [])
        ]}
        rows={data.map((row) => [
          monthLabel(row.month),
          formatCurrency(row.income, currency),
          formatCurrency(row.expense, currency),
          ...(showBalance ? [formatCurrency(row.balance, currency)] : [])
        ])}
      />
    </>
  )
}
