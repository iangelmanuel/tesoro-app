import { Card, cn } from "@heroui/react"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import type { HelpKey } from "@/config/help"
import { Amount } from "./amount"
import { HelpHint } from "./help-hint"
import { TONE_BADGE_CLASSES } from "./tone"

export type StatTrend = "higher-is-better" | "lower-is-better"
export type StatFormat = "currency" | "percent" | "number"

interface StatCardProps {
  label: string
  /** En la moneda del espacio; en `percent`, puntos (12.5 = 12,5 %) */
  value: number | null
  /** Periodo anterior; null/undefined = sin badge */
  previous?: number | null
  trend: StatTrend
  format?: StatFormat
  /** Código ISO de la moneda del espacio (solo `currency`) */
  currency?: string
  help?: HelpKey
  /** Texto corto bajo el valor, por ejemplo el alcance de los filtros */
  caption?: string
  size?: "default" | "sm"
  className?: string
}

const PERCENT = new Intl.NumberFormat("es-CO", {
  style: "percent",
  maximumFractionDigits: 1
})
const NUMBER = new Intl.NumberFormat("es-CO")
const CHANGE = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 })

// Los montos (`currency`) los formatea <Amount />, que puede ocultarlos
function formatValue(value: number, format: Exclude<StatFormat, "currency">) {
  if (format === "percent") return PERCENT.format(value / 100)
  return NUMBER.format(value)
}

/**
 * Variación contra el periodo anterior. En montos y conteos es relativa
 * (%); en porcentajes es la diferencia en puntos (pp), porque "+20 % de una
 * tasa" confunde. null cuando no hay base para comparar.
 */
export function statChange(
  value: number | null,
  previous: number | null | undefined,
  format: StatFormat = "currency"
) {
  if (value === null || previous === null || previous === undefined) {
    return null
  }
  if (format === "percent") return value - previous
  if (previous === 0) return null
  return ((value - previous) / Math.abs(previous)) * 100
}

/**
 * KPI: etiqueta, valor grande y badge con flecha y variación. El color del
 * badge depende del significado, no del signo: con `lower-is-better` (gastos)
 * subir se pinta como malo.
 */
export function StatCard({
  label,
  value,
  previous,
  trend,
  format = "currency",
  currency = "COP",
  help,
  caption,
  size = "default",
  className
}: StatCardProps) {
  const change = statChange(value, previous, format)
  // A un decimal, como se muestra: un 0,04 % no merece badge
  const rounded = change === null ? null : Math.round(change * 10) / 10
  const isUp = rounded !== null && rounded > 0
  const isGood = isUp === (trend === "higher-is-better")
  const unit = format === "percent" ? " pp" : " %"

  return (
    <Card className={cn("gap-3", size === "sm" && "p-4", className)}>
      <dl className="flex flex-col gap-2">
        <div className="flex min-h-6 items-center gap-1">
          <dt className="text-sm text-muted">{label}</dt>
          {help && <HelpHint topic={help} />}
        </div>
        <dd className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span
            className={cn(
              "font-semibold tracking-tight tabular-nums",
              size === "sm" ? "text-xl" : "text-2xl sm:text-3xl"
            )}
          >
            {value === null ? (
              "—"
            ) : format === "currency" ? (
              <Amount
                value={value}
                currency={currency}
              />
            ) : (
              formatValue(value, format)
            )}
          </span>
          {rounded !== null && rounded !== 0 && (
            <span
              className={cn(
                // Texto y flecha del color del significado, con los pares
                // *-soft de HeroUI (≥ 6.9:1). --income/--expense sobre su
                // propio tinte no daban 4.5:1
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
                isGood ? TONE_BADGE_CLASSES.success : TONE_BADGE_CLASSES.danger
              )}
            >
              {isUp ? (
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-3.5"
                />
              ) : (
                <ArrowDownRight
                  aria-hidden="true"
                  className="size-3.5"
                />
              )}
              <span className="sr-only">{isUp ? "Subió" : "Bajó"}</span>
              {CHANGE.format(Math.abs(rounded))}
              {unit}
              <span className="sr-only">
                {" "}
                frente al periodo anterior, {isGood ? "a favor" : "en contra"}
              </span>
            </span>
          )}
        </dd>
        {caption && <dd className="text-xs text-muted">{caption}</dd>}
      </dl>
    </Card>
  )
}
