import { RevealItem, RevealList } from "./reveal"
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

const MAX_WEIGHT = Math.max(...FACTORS.map((factor) => factor.weight))

// Sección del score (SPEC 40): a la izquierda la cifra de ejemplo con su
// escala de bandas; a la derecha los siete factores como lista con su peso,
// una barra fina por factor proporcional al peso
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

        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
          <div className="flex flex-col gap-5 lg:sticky lg:top-24">
            <LandingScoreVisual />
            <p className="text-sm text-pretty text-muted">
              El score se recalcula cada vez que registras algo. A su lado, las
              recomendaciones te dicen qué hacer, en qué dato se basan y dónde
              resolverlo.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="flex items-baseline justify-between gap-4 font-medium">
              Cuánto pesa cada factor
              <span className="text-sm font-normal text-muted">Peso</span>
            </h3>
            <RevealList
              as="ol"
              className="flex flex-col divide-y divide-separator"
            >
              {FACTORS.map((factor) => (
                <RevealItem
                  key={factor.label}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2 py-4 first:pt-0"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{factor.label}</span>
                    <span className="text-sm text-pretty text-muted">
                      {factor.description}
                    </span>
                  </div>
                  <span className="text-lg font-semibold tabular-nums">
                    {factor.weight}&nbsp;%
                  </span>
                  <span
                    aria-hidden="true"
                    className="col-span-2 h-1 overflow-hidden rounded-full bg-default"
                  >
                    <span
                      className="block h-full rounded-full bg-(--income)"
                      style={{
                        width: `${(factor.weight / MAX_WEIGHT) * 100}%`
                      }}
                    />
                  </span>
                </RevealItem>
              ))}
            </RevealList>
          </div>
        </div>
      </div>
    </section>
  )
}
