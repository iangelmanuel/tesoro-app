"use client"

import { createContext, useContext, useId } from "react"
import { cn } from "@heroui/react"
import { ResponsiveContainer } from "recharts"

// Contenedor de las gráficas de Recharts con los tokens del tema de HeroUI:
// ticks con --muted, grilla con --border y cursor con --default. Cada
// serie expone su color como --color-<clave> para usarlo en fill/stroke.
// Las props de forma (grilla, ejes, barras, líneas) están en chart-style.ts

const INITIAL_DIMENSION = { width: 320, height: 200 } as const

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    icon?: React.ComponentType
    /** Color CSS de la serie, normalmente un token: "var(--income)" */
    color?: string
  }
>

const ChartContext = createContext<{ config: ChartConfig } | null>(null)

export function useChart() {
  const context = useContext(ChartContext)

  if (!context) {
    throw new Error("useChart debe usarse dentro de <ChartContainer />")
  }

  return context
}

type ChartContainerProps = React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ComponentProps<typeof ResponsiveContainer>["children"]
  initialDimension?: { width: number; height: number }
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  initialDimension = INITIAL_DIMENSION,
  ...props
}: ChartContainerProps) {
  const uniqueId = useId()
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs text-foreground tabular-nums",
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted",
          "[&_.recharts-cartesian-grid_line]:stroke-border",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
          "[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-default/60",
          "[&_.recharts-radial-bar-background-sector]:fill-default",
          "[&_.recharts-polar-grid_[stroke='#ccc']]:stroke-separator",
          "[&_.recharts-reference-line_[stroke='#ccc']]:stroke-border",
          // Punto activo de las líneas con anillo del color de la tarjeta
          "[&_.recharts-active-dot_circle]:stroke-surface",
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
          // 2 px de superficie entre porciones de la dona
          "[&_.recharts-sector]:stroke-surface [&_.recharts-sector]:stroke-2",
          "[&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden",
          // Con accessibilityLayer la superficie recibe foco: se marca visible
          "[&_.recharts-surface]:rounded-lg [&_.recharts-surface]:outline-none [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-offset-2 [&_.recharts-surface:focus-visible]:outline-focus",
          className
        )}
        {...props}
      >
        <ChartStyle
          id={chartId}
          config={config}
        />
        <ResponsiveContainer initialDimension={initialDimension}>
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

// Los colores son tokens del tema (var(--...)), así que una sola regla sirve
// en claro y en oscuro
function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colors = Object.entries(config).filter(([, item]) => item.color)

  if (!colors.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${id}] {\n${colors
          .map(([key, item]) => `  --color-${key}: ${item.color};`)
          .join("\n")}\n}`
      }}
    />
  )
}

/** Config de la serie o porción de un item del payload de Recharts */
export function getPayloadConfig(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (typeof payload !== "object" || payload === null) {
    return undefined
  }

  const inner =
    "payload" in payload &&
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? (payload.payload as Record<string, unknown>)
      : undefined
  const outer = payload as Record<string, unknown>

  let configKey = key

  if (typeof outer[key] === "string") {
    configKey = outer[key]
  } else if (inner && typeof inner[key] === "string") {
    configKey = inner[key]
  }

  return configKey in config ? config[configKey] : config[key]
}
