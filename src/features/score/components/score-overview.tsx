import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/libs/format"
import { bandInfo } from "../calculations"
import type { BandTone } from "../constants"
import type { Band } from "../types"

const BAND_BADGE_CLASSES: Record<BandTone, string> = {
  danger: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  success:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
}

const BAND_TEXT_CLASSES: Record<BandTone, string> = {
  danger: "text-rose-600 dark:text-rose-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-sky-600 dark:text-sky-400",
  success: "text-emerald-600 dark:text-emerald-400"
}

/** "Débil", "Regular", "Bueno" o "Excelente" con su color */
export function BandBadge({ band }: { band: Band }) {
  const { label, tone } = bandInfo(band)
  return <Badge className={BAND_BADGE_CLASSES[tone]}>{label}</Badge>
}

/** "+3 pts vs. el mes anterior", o "—" si el anterior no tiene score */
export function ScoreVariation({ variation }: { variation: number | null }) {
  if (variation === null) {
    return (
      <span className="text-sm text-muted-foreground">
        — vs. el mes anterior
      </span>
    )
  }

  const sign = variation > 0 ? "+" : ""
  return (
    <span
      className={cn(
        "text-sm tabular-nums",
        variation > 0 && "text-emerald-600 dark:text-emerald-400",
        variation < 0 && "text-rose-600 dark:text-rose-400",
        variation === 0 && "text-muted-foreground"
      )}
    >
      {sign}
      {variation} {Math.abs(variation) === 1 ? "pt" : "pts"} vs. el mes anterior
    </span>
  )
}

interface ScoreOverviewProps {
  score: number
  band: Band
  variation: number | null
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
}

/** Número del score, banda, variación y fecha de cálculo */
export function ScoreOverview({
  score,
  band,
  variation,
  today
}: ScoreOverviewProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <span
          className={cn(
            "text-5xl font-semibold tracking-tight tabular-nums",
            BAND_TEXT_CLASSES[bandInfo(band).tone]
          )}
        >
          {score}
        </span>
        <span className="pb-1.5 text-sm text-muted-foreground">/ 100</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <BandBadge band={band} />
        <ScoreVariation variation={variation} />
      </div>
      <p className="text-xs text-muted-foreground">
        Calculado con tus datos hasta hoy, {formatDate(today)}
      </p>
    </div>
  )
}
