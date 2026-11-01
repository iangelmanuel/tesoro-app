"use client"

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer
} from "@/components/charts/chart-container"
import { HORIZONTAL_BAR_PROPS } from "@/components/charts/chart-style"
import { ChartTooltip } from "@/components/charts/chart-tooltip"
import { formatCurrency } from "@/libs/format"
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
          margin={{ left: 0, right: 0, top: 18, bottom: 0 }}
          barCategoryGap={22}
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
            radius={4}
          >
            {/* Nombre a la izquierda y monto a la derecha, sobre la barra */}
            <LabelList
              dataKey="name"
              position="insideTopLeft"
              offset={0}
              dy={-18}
              className="fill-foreground text-xs"
            />
            <LabelList
              dataKey="total"
              position="insideTopRight"
              offset={0}
              dy={-18}
              className="fill-muted text-xs tabular-nums"
              formatter={(value) => formatCurrency(Number(value), currency)}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      <ChartDataTable
        caption={title}
        headers={["Categoría", "Total"]}
        rows={categories.map((category) => [
          category.name,
          formatCurrency(category.total, currency)
        ])}
      />
    </>
  )
}
