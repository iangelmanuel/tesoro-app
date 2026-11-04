"use client"

import type { ComponentProps } from "react"
import { ChartTooltipContent } from "@/components/charts/chart-tooltip"
import { useFormatAmount } from "@/components/dashboard/hide-amounts-context"

type CurrencyTooltipProps = ComponentProps<typeof ChartTooltipContent> & {
  currency: string
  /** Nombre visible de cada serie o porción, por su clave */
  labels: Record<string, string>
}

// Tooltip de las gráficas con el monto completo en la moneda del espacio y el
// nombre de cada serie (o de la categoría con `nameKey`)
export function CurrencyTooltipContent({
  currency,
  labels,
  ...props
}: CurrencyTooltipProps) {
  const { money } = useFormatAmount()

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
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.payload?.fill ?? item.color }}
            />
            <span className="flex flex-1 items-center justify-between gap-4 leading-none">
              <span className="text-muted">{labels[key] ?? key}</span>
              <span className="font-medium text-foreground tabular-nums">
                {money(Number(value), currency)}
              </span>
            </span>
          </>
        )
      }}
    />
  )
}
