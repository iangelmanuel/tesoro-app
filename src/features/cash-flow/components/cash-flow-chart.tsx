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
import { ChartDataTable } from "@/features/reports/components/chart-data-table"
import { CurrencyTooltipContent } from "@/features/reports/components/currency-tooltip"
import { formatCurrency } from "@/libs/format"
import type { CashFlowMonth } from "../queries"

const CHART_CONFIG = {
  inflow: { label: "Entradas", color: "var(--income)" },
  outflow: { label: "Salidas", color: "var(--expense)" },
  closingBalance: { label: "Saldo en cuentas", color: "var(--balance)" }
} satisfies ChartConfig

const LABELS = {
  inflow: "Entradas",
  outflow: "Salidas",
  closingBalance: "Saldo en cuentas"
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

interface CashFlowChartProps {
  data: CashFlowMonth[]
  currency: string
  className?: string
}

/** Barras de entradas y salidas por mes con la línea del saldo al cierre */
export function CashFlowChart({
  data,
  currency,
  className
}: CashFlowChartProps) {
  const sameYear =
    data.length > 0 &&
    data[0].month.slice(0, 4) === data.at(-1)?.month.slice(0, 4)
  const tickFormat = sameYear ? "MMM" : "MMM yy"
  const range =
    data.length > 0
      ? `de ${monthLabel(data[0].month)} a ${monthLabel(data.at(-1)!.month)}`
      : ""
  const description = `Entradas y salidas por mes con saldo en cuentas al cierre ${range}`

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
            dataKey="inflow"
            fill="var(--color-inflow)"
            radius={4}
          />
          <Bar
            dataKey="outflow"
            fill="var(--color-outflow)"
            radius={4}
          />
          <Line
            dataKey="closingBalance"
            type="monotone"
            stroke="var(--color-closingBalance)"
            strokeWidth={2}
            dot={{ fill: "var(--color-closingBalance)" }}
          />
        </ComposedChart>
      </ChartContainer>
      <ChartDataTable
        caption={description}
        headers={["Mes", "Entradas", "Salidas", "Saldo en cuentas"]}
        rows={data.map((row) => [
          monthLabel(row.month),
          formatCurrency(row.inflow, currency),
          formatCurrency(row.outflow, currency),
          formatCurrency(row.closingBalance, currency)
        ])}
      />
    </>
  )
}
