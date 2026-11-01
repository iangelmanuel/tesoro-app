"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis
} from "recharts"
import {
  type ChartConfig,
  ChartContainer
} from "@/components/charts/chart-container"
import {
  AXIS_PROPS,
  GRID_PROPS,
  LINE_PROPS
} from "@/components/charts/chart-style"
import {
  ChartTooltip,
  ChartTooltipContent
} from "@/components/charts/chart-tooltip"
import { ChartDataTable } from "@/features/reports/components/chart-data-table"

// Serie neutra: el acento del espacio (emerald) se confundía con ingresos
const CHART_CONFIG = {
  score: { label: "Score", color: "var(--chart-1)" }
} satisfies ChartConfig

// Límites de las bandas (docs/producto.md): Regular, Bueno y Excelente
const BAND_TICKS = [0, 40, 60, 80, 100]

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
          title={description}
          margin={{ left: 0, right: 4, top: 8 }}
        >
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey="month"
            {...AXIS_PROPS}
            tickFormatter={(month: string) =>
              format(toDate(month), "MMM yy", { locale: es })
            }
          />
          <YAxis
            domain={[0, 100]}
            ticks={BAND_TICKS}
            {...AXIS_PROPS}
            width={32}
          />
          <ReferenceLine
            y={60}
            strokeDasharray="3 4"
            label={{
              value: "Bueno",
              position: "insideTopRight",
              className: "fill-muted text-xs"
            }}
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
            stroke="var(--color-score)"
            {...LINE_PROPS}
            // Con meses sin datos, los puntos dejan ver los valores sueltos
            dot={{ r: 2.5, fill: "var(--color-score)", strokeWidth: 0 }}
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
