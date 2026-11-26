"use client"

import { Suspense, lazy } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import type { ScoreHistoryChart as Chart } from "./score-history-chart"

// Recharts va en su propio chunk (SPEC 56b): ver income-expense-chart-lazy
// en reports
const ScoreHistoryChart = lazy(() =>
  import("./score-history-chart").then((m) => ({
    default: m.ScoreHistoryChart
  }))
)

/** Hueco de la gráfica de evolución: misma altura que su ChartContainer */
export function ScoreHistoryChartSkeleton() {
  return (
    <Skeleton
      aria-hidden="true"
      className="h-64 w-full rounded-2xl"
    />
  )
}

export function ScoreHistoryChartLazy(
  props: React.ComponentProps<typeof Chart>
) {
  return (
    <Suspense fallback={<ScoreHistoryChartSkeleton />}>
      <ScoreHistoryChart {...props} />
    </Suspense>
  )
}
