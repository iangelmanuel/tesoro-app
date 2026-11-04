import { cn } from "@heroui/react"
import { TONE_BADGE_CLASSES } from "@/components/dashboard/tone"
import { RevealItem, RevealList, ScrollWipe } from "./reveal"
import { SCORE_BANDS } from "./score-bands"
import { LandingScoreVisual } from "./score-visual"
import { SectionHeading } from "./section-heading"

// Constantes de presentación copiadas de docs/producto.md ("Factores y
// pesos"). La fuente de verdad del cálculo es src/features/score/constants.ts:
// si cambian los pesos allá, cambian aquí. Suman 100.
const FACTORS = [
  {
    label: "Tasa de ahorro",
    weight: 25,
    description: "Cuánto de lo que ganas te queda después de gastar."
  },
  {
    label: "Deuda / ingresos",
    weight: 20,
    description: "Qué parte de tu ingreso se va en cuotas y pagos mínimos."
  },
  {
    label: "Colchón",
    weight: 15,
    description: "Cuántos meses de gastos podrías cubrir con lo ahorrado."
  },
  {
    label: "Presupuestos",
    weight: 15,
    description: "Cuántos presupuestos del mes cumples."
  },
  {
    label: "Utilización de tarjetas",
    weight: 10,
    description: "Cuánto debes en tus tarjetas frente a su cupo."
  },
  {
    label: "Metas",
    weight: 10,
    description: "Cuántas metas de ahorro van en camino."
  },
  {
    label: "Regularidad",
    weight: 5,
    description: "Qué tan seguido registras tus movimientos."
  }
]

// Un solo tono de marca, del más intenso al más suave según el peso
const SHADES = [100, 82, 66, 54, 42, 32, 22]

export function ScoreSection() {
  return (
    <section
      id="score"
      aria-labelledby="score-title"
      className="scroll-mt-16"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading
          id="score-title"
          title="Tu salud financiera, en un número de 0 a 100"
          description="Siete factores calculados sobre tus propios registros. Si uno no aplica, por ejemplo porque no tienes tarjetas, se deja por fuera y los demás se reparten su peso."
        />

        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <h3 className="font-medium">Cuánto pesa cada factor</h3>
              {/* Barra única que suma 100: cada tramo es la parte del score */}
              <ScrollWipe>
                <div
                  aria-hidden="true"
                  className="flex h-3 gap-0.5 overflow-hidden rounded-full"
                >
                  {FACTORS.map((factor, index) => (
                    <div
                      key={factor.label}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      style={{
                        width: `${factor.weight}%`,
                        backgroundColor: `color-mix(in oklab, var(--income) ${SHADES[index]}%, transparent)`
                      }}
                    />
                  ))}
                </div>
              </ScrollWipe>
            </div>

            <RevealList className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {FACTORS.map((factor, index) => (
                <RevealItem
                  key={factor.label}
                  className="flex gap-3"
                >
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: `color-mix(in oklab, var(--income) ${SHADES[index]}%, transparent)`
                    }}
                  />
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium">{factor.label}</span>
                      <span className="text-sm text-muted tabular-nums">
                        {factor.weight} %
                      </span>
                    </div>
                    <p className="text-sm text-pretty text-muted">
                      {factor.description}
                    </p>
                  </div>
                </RevealItem>
              ))}
            </RevealList>

            <div className="flex flex-col gap-3">
              <h3 className="font-medium">Qué dice cada rango</h3>
              <ul className="flex flex-wrap gap-2">
                {SCORE_BANDS.map((band) => (
                  <li
                    key={band.label}
                    className={cn(
                      "rounded-full px-3 py-1 text-sm",
                      TONE_BADGE_CLASSES[band.tone]
                    )}
                  >
                    <span className="font-medium">{band.label}</span>{" "}
                    <span className="tabular-nums">
                      {band.from}–{band.to}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-pretty text-muted">
                El score se recalcula cada vez que registras algo. A su lado,
                las recomendaciones te dicen qué hacer, en qué dato se basan y
                dónde resolverlo.
              </p>
            </div>
          </div>

          <LandingScoreVisual />
        </div>
      </div>
    </section>
  )
}
