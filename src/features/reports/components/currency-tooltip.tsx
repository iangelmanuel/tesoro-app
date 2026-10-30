"use client"

import type { ComponentProps } from "react"
import { ChartTooltipContent } from "@/components/ui/chart"
import { formatCurrency } from "@/libs/format"

type CurrencyTooltipProps = ComponentProps<typeof ChartTooltipContent> & {
  currency: string
  /** Nombre visible de cada serie o porción, por su clave */
  labels: Record<string, string>
}

// Tooltip de shadcn con los valores en moneda en vez de toLocaleString
export function CurrencyTooltipContent({
  currency,
  labels,
  ...props
}: CurrencyTooltipProps) {
  return (
    <ChartTooltipContent
      {...props}
      formatter={(value, name, item) => {
        // Con `nameKey` la etiqueta sale de la fila (p. ej. la categoría), no
        // del nombre de la serie
        const key = String(
          (props.nameKey && item.payload?.[props.nameKey]) ?? name
        )

        return (
          <>
            <span
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: item.payload?.fill ?? item.color }}
            />
            <span className="flex flex-1 items-center justify-between gap-4 leading-none">
              <span className="text-muted-foreground">
                {labels[key] ?? key}
              </span>
              <span className="font-mono font-medium text-foreground tabular-nums">
                {formatCurrency(Number(value), currency)}
              </span>
            </span>
          </>
        )
      }}
    />
  )
}
