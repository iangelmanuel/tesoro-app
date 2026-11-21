import { TONE_BADGE_CLASSES } from "@/components/dashboard/tone"
import { cn } from "@/libs/cn"
import { SCORE_BANDS } from "./score-bands"

// Ejemplo del score (datos ficticios): solo la cifra, su escala y su banda.
// El detalle (rangos de cada banda, qué mide cada factor) vive en el
// dashboard, junto al score real

const SCORE = 78

const ACTIVE = SCORE_BANDS.find(
  (band) => SCORE >= band.from && SCORE <= band.to
)

export function LandingScoreVisual() {
  return (
    <figure className="flex flex-col items-start gap-4">
      <p className="flex items-baseline gap-2">
        <span className="text-8xl leading-none font-semibold tracking-tight tabular-nums">
          {SCORE}
        </span>
        <span className="text-2xl text-muted-foreground tabular-nums">
          / 100
        </span>
      </p>
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {ACTIVE && (
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 font-medium",
              TONE_BADGE_CLASSES[ACTIVE.tone]
            )}
          >
            {ACTIVE.label}
          </span>
        )}
        <span className="text-muted-foreground">Datos de ejemplo</span>
      </figcaption>
    </figure>
  )
}
