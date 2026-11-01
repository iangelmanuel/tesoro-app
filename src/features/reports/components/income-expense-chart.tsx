"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer
} from "@/components/charts/chart-container"
import { formatCompactCurrency } from "@/components/charts/chart-format"
import {
  ChartLegend,
  ChartLegendContent
} from "@/components/charts/chart-legend"
import {
  AXIS_PROPS,
  BAR_CHART_PROPS,
  BAR_PROPS,
  GRID_PROPS,
  LINE_PROPS
} from "@/components/charts/chart-style"
import { ChartTooltip } from "@/components/charts/chart-tooltip"
import { formatCurrency } from "@/libs/format"
import { REPORT_LABELS, type ReportLabels } from "../labels"
import type { MonthlyTotal } from "../queries"
import { ChartDataTable } from "./chart-data-table"
import { CurrencyTooltipContent } from "./currency-tooltip"

// `month` es una fecha de Postgres: se arma en local para que no se corra
function toDate(month: string) {
  const [year, monthIndex] = month.split("-").map(Number)
  return new Date(year, monthIndex - 1, 1)
}

function monthLabel(month: string) {
  return format(toDate(month), "MMMM yyyy", { locale: es })
}

type SeriesLabels = Pick<ReportLabels, "income" | "expense" | "series">

interface IncomeExpenseChartProps {
  data: MonthlyTotal[]
  currency: string
  /** Agrega la línea de balance sobre las barras */
  showBalance?: boolean
  /** Textos de las series según el espacio. Por defecto, los de Personal */
  labels?: SeriesLabels
  /**
   * "inline": leyenda dentro de la gráfica, arriba a la derecha. "none":
   * la pinta la cabecera de ChartCard con incomeExpenseLegend()
   */
  legend?: "inline" | "none"
  className?: string
}

export function IncomeExpenseChart({
  data,
  currency,
  showBalance = false,
  labels = REPORT_LABELS.personal,
  legend = "inline",
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
          // Nombre de la superficie enfocable (role="application")
          title={description}
          margin={{ left: 0, right: 4, top: 4 }}
          {...BAR_CHART_PROPS}
        >
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey="month"
            {...AXIS_PROPS}
            tickFormatter={(month: string) =>
              format(toDate(month), tickFormat, { locale: es })
            }
          />
          <YAxis
            {...AXIS_PROPS}
            width={64}
            tickFormatter={(value: number) =>
              formatCompactCurrency(value, currency)
            }
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
          {legend === "inline" && (
            <ChartLegend
              verticalAlign="top"
              align="right"
              content={<ChartLegendContent className="justify-end" />}
            />
          )}
          <Bar
            dataKey="income"
            fill="var(--color-income)"
            {...BAR_PROPS}
          />
          <Bar
            dataKey="expense"
            fill="var(--color-expense)"
            {...BAR_PROPS}
          />
          {showBalance && (
            <Line
              dataKey="balance"
              stroke="var(--color-balance)"
              {...LINE_PROPS}
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
