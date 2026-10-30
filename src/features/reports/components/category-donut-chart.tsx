"use client"

import { Label, Pie, PieChart } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip
} from "@/components/ui/chart"
import { formatCurrency } from "@/libs/format"
import type { CategorySlice } from "../chart-data"
import { ChartDataTable } from "./chart-data-table"
import { CurrencyTooltipContent } from "./currency-tooltip"

const PERCENT = new Intl.NumberFormat("es-CO", {
  style: "percent",
  maximumFractionDigits: 1
})

interface CategoryDonutChartProps {
  slices: CategorySlice[]
  currency: string
  /** Qué se reparte, p. ej. "Gastos por categoría de octubre 2026" */
  title: string
  className?: string
}

export function CategoryDonutChart({
  slices,
  currency,
  title,
  className
}: CategoryDonutChartProps) {
  const total = slices.reduce((sum, slice) => sum + slice.total, 0)
  const data = slices.map((slice) => ({ ...slice, fill: slice.color }))
  const labels = Object.fromEntries(
    slices.map((slice) => [slice.key, slice.name])
  )
  const config = Object.fromEntries(
    slices.map((slice) => [slice.key, { label: slice.name }])
  ) satisfies ChartConfig
  const share = (value: number) => PERCENT.format(total ? value / total : 0)

  return (
    <div className="flex flex-col gap-4">
      <ChartContainer
        config={config}
        className={className ?? "mx-auto aspect-square max-h-64 w-full"}
        role="figure"
        aria-label={`${title}. Total ${formatCurrency(total, currency)}`}
      >
        <PieChart accessibilityLayer>
          <ChartTooltip
            content={
              <CurrencyTooltipContent
                currency={currency}
                labels={labels}
                nameKey="key"
                hideLabel
              />
            }
          />
          <Pie
            data={data}
            dataKey="total"
            nameKey="key"
            innerRadius="62%"
            outerRadius="90%"
            paddingAngle={slices.length > 1 ? 2 : 0}
            strokeWidth={0}
          >
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox)) return null
                const { cx, cy } = viewBox

                return (
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={cx}
                      y={cy}
                      className="fill-foreground text-base font-semibold"
                    >
                      {formatCurrency(total, currency)}
                    </tspan>
                    <tspan
                      x={cx}
                      y={(cy ?? 0) + 20}
                      className="fill-muted-foreground text-xs"
                    >
                      Total
                    </tspan>
                  </text>
                )
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul
        className="grid gap-2 text-sm"
        aria-hidden
      >
        {slices.map((slice) => (
          <li
            key={slice.key}
            className="flex items-center gap-2"
          >
            <span
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: slice.color }}
            />
            <span className="flex-1 truncate">{slice.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {share(slice.total)}
            </span>
            <span className="font-medium tabular-nums">
              {formatCurrency(slice.total, currency)}
            </span>
          </li>
        ))}
      </ul>
      <ChartDataTable
        caption={title}
        headers={["Categoría", "Total", "% del total"]}
        rows={slices.map((slice) => [
          slice.name,
          formatCurrency(slice.total, currency),
          share(slice.total)
        ])}
      />
    </div>
  )
}
