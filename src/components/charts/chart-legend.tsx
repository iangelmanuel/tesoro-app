"use client"

import { cn } from "@heroui/react"
import { type DefaultLegendContentProps, Legend } from "recharts"
import { getPayloadConfig, useChart } from "./chart-container"

export const ChartLegend = Legend

type ChartLegendContentProps = React.ComponentProps<"div"> & {
  hideIcon?: boolean
  nameKey?: string
} & DefaultLegendContentProps

// Leyenda con la tipografía de HeroUI: texto atenuado y muestra del color
export function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey
}: ChartLegendContentProps) {
  const { config } = useChart()

  if (!payload?.length) {
    return null
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-4 text-xs text-muted",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {payload
        .filter((item) => item.type !== "none")
        .map((item, index) => {
          const key = `${nameKey ?? item.dataKey ?? "value"}`
          const itemConfig = getPayloadConfig(config, item, key)

          return (
            <div
              key={index}
              className="flex items-center gap-1.5 [&>svg]:size-3"
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <span
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: item.color }}
                />
              )}
              {itemConfig?.label}
            </div>
          )
        })}
    </div>
  )
}
