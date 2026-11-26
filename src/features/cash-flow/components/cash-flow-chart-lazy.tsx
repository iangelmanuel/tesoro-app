"use client"

import { Suspense, lazy } from "react"
import { ChartSkeleton } from "@/components/charts/chart-skeleton"
import type { CashFlowChart as Chart } from "./cash-flow-chart"

// Recharts va en su propio chunk (SPEC 56b): ver income-expense-chart-lazy
// en reports
const CashFlowChart = lazy(() =>
  import("./cash-flow-chart").then((m) => ({ default: m.CashFlowChart }))
)

export function CashFlowChartLazy(props: React.ComponentProps<typeof Chart>) {
  return (
    <Suspense fallback={<ChartSkeleton className={props.className} />}>
      <CashFlowChart {...props} />
    </Suspense>
  )
}
