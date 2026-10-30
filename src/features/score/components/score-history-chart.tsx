"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from "@/components/ui/chart"
import { ChartDataTable } from "@/features/reports/components/chart-data-table"

const CHART_CONFIG = {
  score: { label: "Score", color: "var(--primary)" }
} satisfies ChartConfig

export interface ScoreHistoryPoint {
  /** YYYY-MM */
  month: string
  /** null si el mes no tiene datos suficientes */
  score: number | null
}

// `month` es YYYY-MM: se arma en local para que no se corra
function toDate(month: string) {
  const [year, monthIndex] = month.split("-").map(Number)
  return new Date(year, monthIndex - 1, 1)
}

function monthLabel(month: string) {
  return format(toDate(month), "MMMM yyyy", { locale: es })
}

/** Línea del score de los últimos 12 meses, con huecos en los meses sin datos */
export function ScoreHistoryChart({ data }: { data: ScoreHistoryPoint[] }) {
  const description =
    data.length > 0
      ? `Score por mes de ${monthLabel(data[0].month)} a ${monthLabel(data.at(-1)!.month)}`
      : "Score por mes"

  return (
    <>
      <ChartContainer
        config={CHART_CONFIG}
        className="aspect-auto h-64 w-full"
        role="figure"
        aria-label={description}
      >
        <LineChart
          data={data}
          accessibilityLayer
          margin={{ left: 4, right: 4, top: 8 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(month: string) =>
              format(toDate(month), "MMM yy", { locale: es })
            }
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 40, 60, 80, 100]}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  payload[0] ? monthLabel(String(payload[0].payload.month)) : ""
                }
              />
            }
          />
          <Line
            dataKey="score"
            type="monotone"
            stroke="var(--color-score)"
            strokeWidth={2}
            dot={{ fill: "var(--color-score)" }}
            connectNulls={false}
          />
        </LineChart>
      </ChartContainer>
      <ChartDataTable
        caption={description}
        headers={["Mes", "Score"]}
        rows={data.map((point) => [
          monthLabel(point.month),
          point.score === null ? "Sin datos suficientes" : String(point.score)
        ])}
      />
    </>
  )
}
