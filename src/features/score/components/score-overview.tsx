import { Chip, cn } from "@heroui/react"
import {
  TONE_BADGE_CLASSES as TONE_BADGE,
  TONE_TEXT_CLASSES as TONE_TEXT
} from "@/components/dashboard/tone"
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
  return (
    <Chip
      size="sm"
      className={BAND_BADGE_CLASSES[tone]}
      color="accent"
      variant="primary"
    >
      {label}
    </Chip>
  )
}

/** "+3 pts vs. el mes anterior", o "Sin comparación aún" si el anterior no tiene score */
export function ScoreVariation({ variation }: { variation: number | null }) {
  if (variation === null) {
    return <span className="text-sm text-muted">Sin comparación aún</span>
  }

  const sign = variation > 0 ? "+" : ""
  return (
    <span
      className={cn(
        "text-sm tabular-nums",
        variation > 0 && "text-(--income)",
        variation < 0 && "text-(--expense)",
        variation === 0 && "text-muted"
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
        <span className="pb-1.5 text-sm text-muted">/ 100</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <BandBadge band={band} />
        <ScoreVariation variation={variation} />
      </div>
      <p className="text-xs text-muted">
        Calculado con tus datos hasta hoy, {formatDate(today)}
      </p>
    </div>
  )
}
