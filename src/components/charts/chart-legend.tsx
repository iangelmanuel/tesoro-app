"use client"

import { type DefaultLegendContentProps, Legend } from "recharts"
import { cn } from "@/libs/cn"
import { getPayloadConfig, useChart } from "./chart-container"

export const ChartLegend = Legend

type ChartLegendContentProps = React.ComponentProps<"div"> & {
  /** Muestra el color de la serie en vez de su ícono */
  hideIcon?: boolean
  /** Campo del dato que da la clave de `config` de cada ítem */
  nameKey?: string
} & DefaultLegendContentProps

// Leyenda dentro de Recharts (punto de color + texto). Para la leyenda
// compacta de la cabecera, usa ChartLegendList de chart-card.tsx
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
        "flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground",
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
                  className="size-2 shrink-0 rounded-full"
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
