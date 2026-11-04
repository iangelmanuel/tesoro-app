"use client"

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer
} from "@/components/charts/chart-container"
import { HORIZONTAL_BAR_PROPS } from "@/components/charts/chart-style"
import { ChartTooltip } from "@/components/charts/chart-tooltip"
import { useFormatAmount } from "@/components/dashboard/hide-amounts-context"
import type { CategorySlice } from "../chart-data"
import { ChartDataTable } from "./chart-data-table"
import { CurrencyTooltipContent } from "./currency-tooltip"

// Cada fila: nombre y monto arriba (no se cortan a 375 px) y la barra debajo
const ROW_HEIGHT = 48

interface TopCategoriesChartProps {
  categories: CategorySlice[]
  currency: string
  /** Qué se ordena, p. ej. "Top 5 categorías de gasto de octubre 2026" */
  title: string
}

export function TopCategoriesChart({
  categories,
  currency,
  title
}: TopCategoriesChartProps) {
  const { money } = useFormatAmount()
  const data = categories.map((category) => ({
    ...category,
    fill: category.color
  }))
  const labels = Object.fromEntries(
    categories.map((category) => [category.key, category.name])
  )
  const config = { total: { label: "Total" } } satisfies ChartConfig

  return (
    <>
      <ChartContainer
        config={config}
        className="aspect-auto w-full"
        style={{ height: categories.length * ROW_HEIGHT + 8 }}
        role="figure"
        aria-label={title}
      >
        <BarChart
          data={data}
          layout="vertical"
          accessibilityLayer
          title={title}
          margin={{ left: 0, right: 0, top: 20, bottom: 0 }}
        >
          <XAxis
            type="number"
            dataKey="total"
            hide
          />
          <YAxis
            type="category"
            dataKey="name"
            hide
          />
          <ChartTooltip
            cursor={false}
            content={
              <CurrencyTooltipContent
                currency={currency}
                labels={labels}
                nameKey="key"
                hideLabel
              />
            }
          />
          <Bar
            dataKey="total"
            {...HORIZONTAL_BAR_PROPS}
            barSize={12}
            radius={4}
          >
            {/* "Nombre · monto" en una línea sobre la barra. Con `content`
                propio el texto no se ajusta al ancho de la barra (las
                posiciones inside* lo partían y se encimaba con el monto) */}
            <LabelList
              dataKey="total"
              content={(props) => {
                const { x, y, index } = props
                const row = index === undefined ? undefined : data[index]
                if (!row) return null
                return (
                  <text
                    x={Number(x)}
                    y={Number(y) - 8}
                    className="text-xs"
                  >
                    <tspan className="fill-foreground">{row.name}</tspan>
                    <tspan className="fill-muted tabular-nums">
                      {` · ${money(row.total, currency)}`}
                    </tspan>
                  </text>
                )
              }}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      <ChartDataTable
        caption={title}
        headers={["Categoría", "Total"]}
        rows={categories.map((category) => [
          category.name,
          money(category.total, currency)
        ])}
      />
    </>
  )
}
