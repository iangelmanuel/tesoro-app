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
import { REPORT_LABELS, type ReportLabels } from "../labels"
import type { MonthlyTotal } from "../queries"
import { ChartDataTable } from "./chart-data-table"
import { CurrencyTooltipContent } from "./currency-tooltip"

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
  /** Textos de las series según el espacio. Por defecto, los de Personal */
  labels?: Pick<ReportLabels, "income" | "expense" | "series">
  className?: string
}

export function IncomeExpenseChart({
  data,
  currency,
  showBalance = false,
  labels = REPORT_LABELS.personal,
  className
}: IncomeExpenseChartProps) {
  const seriesLabels = {
    income: labels.income,
    expense: labels.expense,
    balance: "Balance"
  }
  const chartConfig = {
    income: { label: labels.income, color: "var(--income)" },
    expense: { label: labels.expense, color: "var(--expense)" },
    balance: { label: "Balance", color: "var(--balance)" }
  } satisfies ChartConfig
  const sameYear =
    data.length > 0 &&
    data[0].month.slice(0, 4) === data.at(-1)?.month.slice(0, 4)
  const tickFormat = sameYear ? "MMM" : "MMM yy"
  const range =
    data.length > 0
      ? `de ${monthLabel(data[0].month)} a ${monthLabel(data.at(-1)!.month)}`
      : ""
  const description = `${labels.series}${showBalance ? " con balance" : ""} por mes ${range}`

  return (
    <>
      <ChartContainer
        config={chartConfig}
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
                labels={seriesLabels}
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
          labels.income,
          labels.expense,
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
