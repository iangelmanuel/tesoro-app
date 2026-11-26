"use client"

import { Suspense, lazy } from "react"
import { ChartSkeleton } from "@/components/charts/chart-skeleton"
import { topCategoriesChartHeight } from "./chart-sizes"
import type { TopCategoriesChart as Chart } from "./top-categories-chart"

// Recharts va en su propio chunk (SPEC 56b): ver income-expense-chart-lazy
const TopCategoriesChart = lazy(() =>
  import("./top-categories-chart").then((m) => ({
    default: m.TopCategoriesChart
  }))
)

export function TopCategoriesChartLazy(
  props: React.ComponentProps<typeof Chart>
) {
  return (
    <Suspense
      fallback={
        <ChartSkeleton
          className="aspect-auto"
          style={{ height: topCategoriesChartHeight(props.categories.length) }}
        />
      }
    >
      <TopCategoriesChart {...props} />
    </Suspense>
  )
}
