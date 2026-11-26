"use client"

import { Suspense, lazy } from "react"
import { ChartSkeleton } from "@/components/charts/chart-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/libs/cn"
import type { CategoryDonutChart as Chart } from "./category-donut-chart"
import { DONUT_CLASS } from "./chart-sizes"

// Recharts va en su propio chunk (SPEC 56b): ver income-expense-chart-lazy
const CategoryDonutChart = lazy(() =>
  import("./category-donut-chart").then((m) => ({
    default: m.CategoryDonutChart
  }))
)

export function CategoryDonutChartLazy(
  props: React.ComponentProps<typeof Chart>
) {
  return (
    <Suspense
      fallback={
        // Mismo contenedor: la dona y la lista de porciones debajo
        <div
          className="flex flex-col gap-4"
          aria-hidden="true"
        >
          <ChartSkeleton
            className={cn("rounded-full", props.className ?? DONUT_CLASS)}
          />
          <div className="grid gap-2">
            {props.slices.map((slice) => (
              <Skeleton
                key={slice.key}
                className="h-5 w-full"
              />
            ))}
          </div>
        </div>
      }
    >
      <CategoryDonutChart {...props} />
    </Suspense>
  )
}
