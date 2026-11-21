import {
  TONE_BADGE_CLASSES as TONE_BADGE,
  TONE_TEXT_CLASSES as TONE_TEXT
} from "@/components/dashboard/feedback/tone"
import { ToneBadge } from "@/components/dashboard/feedback/tone-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/libs/cn"
import { formatDate } from "@/libs/format"
import type { BandTone } from "../constants"
import { bandInfo } from "../curves"
import type { Band } from "../types"

const BAND_BADGE_CLASSES: Record<BandTone, string> = {
  danger: TONE_BADGE.danger,
  warning: TONE_BADGE.warning,
  info: TONE_BADGE.info,
  success: TONE_BADGE.success
}

const BAND_TEXT_CLASSES: Record<BandTone, string> = {
  danger: TONE_TEXT.danger,
  warning: TONE_TEXT.warning,
  info: TONE_TEXT.info,
  success: TONE_TEXT.success
}

/** "Débil", "Regular", "Bueno" o "Excelente" con su color */
export function BandBadge({ band }: { band: Band }) {
  const { label, tone } = bandInfo(band)
  return <ToneBadge className={BAND_BADGE_CLASSES[tone]}>{label}</ToneBadge>
}

/** "+3 pts vs. el mes anterior", o "Sin comparación aún" si el anterior no tiene score */
export function ScoreVariation({ variation }: { variation: number | null }) {
  if (variation === null) {
    return (
      <span className="text-sm text-muted-foreground">Sin comparación aún</span>
    )
  }

  const sign = variation > 0 ? "+" : ""
  return (
    <span
      className={cn(
        "text-sm tabular-nums",
        variation > 0 && "text-(--income)",
        variation < 0 && "text-(--expense)",
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

/** Hueco de ScoreOverview: cifra, banda, variación y fecha */
export function ScoreOverviewSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-3"
    >
      <div className="flex h-12 items-end gap-2">
        <Skeleton className="h-11 w-20" />
        <Skeleton className="mb-1.5 h-4 w-10" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-16 rounded-4xl" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-3 w-52" />
    </div>
  )
}
