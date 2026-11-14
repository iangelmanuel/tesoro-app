import { ScrollWipe } from "./reveal"
import { LandingScoreVisual } from "./score-visual"
import { SectionHeading } from "./section-heading"

// Constantes de presentación copiadas de docs/producto.md ("Factores y
// pesos"). La fuente de verdad del cálculo es src/features/score/constants.ts:
// si cambian los pesos allá, cambian aquí. Suman 100.
const FACTORS = [
  { label: "Tasa de ahorro", weight: 25 },
  { label: "Deuda / ingresos", weight: 20 },
  { label: "Colchón", weight: 15 },
  { label: "Presupuestos", weight: 15 },
  { label: "Utilización de tarjetas", weight: 10 },
  { label: "Metas", weight: 10 },
  { label: "Regularidad", weight: 5 }
]

// Un solo tono de --income, más intenso cuanto más pesa el factor
const SHADES = [100, 90, 82, 74, 66, 58, 50]

const shade = (index: number) =>
  `color-mix(in oklab, var(--income) ${SHADES[index]}%, transparent)`

// Sección del score (SPEC 40, simplificada): la cifra a la izquierda y, a la
// derecha, de qué está hecha: una barra que suma 100 y los siete factores
// con su peso. Sin descripciones ni rangos: eso se explica en el dashboard
export function ScoreSection() {
  return (
    <section
      id="score"
      aria-labelledby="score-title"
      className="scroll-mt-16"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading
          id="score-title"
          title="Tu salud financiera, en un número de 0 a 100"
          description="Sale de tus propios registros y se actualiza cada vez que anotas algo."
        />

        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-20">
          <LandingScoreVisual />

          <div className="flex flex-col gap-6">
            <h3 className="font-medium">
              Siete factores, cada uno con su peso
            </h3>
            <ScrollWipe>
              <div
                aria-hidden="true"
                className="flex h-3 gap-1"
              >
                {FACTORS.map((factor, index) => (
                  <span
                    key={factor.label}
                    className="h-full rounded-full"
                    style={{
                      flex: `${factor.weight} 1 0%`,
                      backgroundColor: shade(index)
                    }}
                  />
                ))}
              </div>
            </ScrollWipe>
            <ol className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
              {FACTORS.map((factor, index) => (
                <li
                  key={factor.label}
                  className="flex items-center gap-3"
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: shade(index) }}
                  />
                  <span className="min-w-0 flex-1">{factor.label}</span>
                  <span className="text-muted tabular-nums">
                    {factor.weight}&nbsp;%
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}
