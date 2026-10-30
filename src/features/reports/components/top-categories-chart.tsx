"use client"

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip
} from "@/components/ui/chart"
import { formatCurrency } from "@/libs/format"
import type { CategorySlice } from "../chart-data"
import { ChartDataTable } from "./chart-data-table"
import { CurrencyTooltipContent } from "./currency-tooltip"

const BAR_HEIGHT = 44

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
        style={{ height: categories.length * BAR_HEIGHT + 16 }}
        role="figure"
        aria-label={title}
      >
        <BarChart
          data={data}
          layout="vertical"
          accessibilityLayer
          margin={{ left: 0, right: 96 }}
        >
          <XAxis
            type="number"
            dataKey="total"
            hide
          />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            width={112}
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
            radius={4}
          >
            <LabelList
              dataKey="total"
              position="right"
              offset={8}
              className="fill-foreground"
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
