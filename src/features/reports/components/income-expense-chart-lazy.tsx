"use client"

import { Suspense, lazy } from "react"
import { ChartSkeleton } from "@/components/charts/chart-skeleton"
import type { IncomeExpenseChart as Chart } from "./income-expense-chart"

// Recharts va en su propio chunk (SPEC 56b). Con SSR la gráfica llega
// pintada en el HTML; el hueco solo se ve si el chunk aún no llegó en una
// navegación del cliente, con las mismas medidas que la gráfica
const IncomeExpenseChart = lazy(() =>
  import("./income-expense-chart").then((m) => ({
    default: m.IncomeExpenseChart
  }))
)

export function IncomeExpenseChartLazy(
  props: React.ComponentProps<typeof Chart>
) {
  return (
    <Suspense fallback={<ChartSkeleton className={props.className} />}>
      <IncomeExpenseChart {...props} />
    </Suspense>
  )
}
