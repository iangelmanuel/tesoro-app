import { cn } from "@heroui/react"
import { TONE_BADGE_CLASSES } from "@/components/dashboard/tone"
import { ScrollWipe } from "./reveal"
import { SCORE_BANDS } from "./score-bands"

// Ejemplo del score (datos ficticios, SPEC 40): la cifra es la protagonista,
// con su banda y una frase de lectura, y debajo las cuatro bandas como una
// sola escala de 0 a 100 con un marcador en el valor. Componente de servidor:
// sin contador animado, solo la escala se descubre con el scroll

const SCORE = 78
const READING = "Vas bien, y tu colchón es lo que más puede subir."

const ACTIVE = SCORE_BANDS.find(
  (band) => SCORE >= band.from && SCORE <= band.to
)

export function LandingScoreVisual() {
  return (
    <figure className="flex flex-col gap-8 rounded-3xl bg-surface p-6 shadow-(--surface-shadow) sm:p-8">
      <figcaption className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium">Salud financiera</span>
        <span className="text-muted">Datos de ejemplo</span>
      </figcaption>

      <div className="flex flex-col gap-3">
        <p className="flex items-baseline gap-2">
          <span className="text-7xl leading-none font-semibold tracking-tight tabular-nums sm:text-8xl">
            {SCORE}
          </span>
          <span className="text-xl text-muted tabular-nums">/ 100</span>
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-pretty">
          {ACTIVE && (
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-sm font-medium",
                TONE_BADGE_CLASSES[ACTIVE.tone]
              )}
            >
              {ACTIVE.label}
            </span>
          )}
          <span className="text-muted">{READING}</span>
        </p>
      </div>

      {/* Escala única: cada banda ocupa su rango y el marcador cae en el
          valor. Las etiquetas van debajo del tramo que nombran */}
      <div className="flex flex-col gap-2">
        <h3 className="sr-only">Qué dice cada rango</h3>
        <div className="relative pt-4">
          <span
            aria-hidden="true"
            className="absolute top-0 size-0 -translate-x-1/2 border-x-[6px] border-t-8 border-x-transparent border-t-foreground"
            style={{ left: `${SCORE}%` }}
          />
          <ScrollWipe>
            <div
              aria-hidden="true"
              className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
            >
              {SCORE_BANDS.map((band) => (
                <span
                  key={band.label}
                  className="h-full"
                  style={{
                    flex: `${band.to - band.from + 1} 1 0%`,
                    backgroundColor: band.color
                  }}
                />
              ))}
            </div>
          </ScrollWipe>
        </div>
        <ul className="flex gap-0.5 text-xs sm:text-sm">
          {SCORE_BANDS.map((band) => (
            <li
              key={band.label}
              className="flex min-w-0 flex-col"
              style={{ flex: `${band.to - band.from + 1} 1 0%` }}
            >
              <span
                className={cn(
                  "truncate",
                  band === ACTIVE ? "font-medium" : "text-muted"
                )}
              >
                {band.label}
              </span>
              <span className="text-xs text-muted tabular-nums">
                {band.from}–{band.to}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  )
}
