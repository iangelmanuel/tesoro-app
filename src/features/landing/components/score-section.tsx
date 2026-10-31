import { cn } from "@/libs/utils"
import { SectionHeading } from "./section-heading"

// Constantes de presentación copiadas de docs/producto.md ("Factores y
// pesos" y "Bandas"). La fuente de verdad del cálculo es
// src/features/score/constants.ts: si cambian los pesos allá, cambian aquí
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
    description: "Cuántos meses de gastos cubre tu balance."
  },
  {
    label: "Presupuestos",
    weight: 15,
    description: "Cuántos presupuestos del mes cumples."
  },
  {
    label: "Utilización de tarjetas",
    weight: 10,
    description: "Saldo de tus tarjetas frente a su cupo."
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

// Mismos colores que BandBadge en src/features/score/components/
const BANDS = [
  {
    label: "Débil",
    range: "0 – 39",
    className: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
  },
  {
    label: "Regular",
    range: "40 – 59",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
  },
  {
    label: "Bueno",
    range: "60 – 79",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
  },
  {
    label: "Excelente",
    range: "80 – 100",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
  }
]

export function ScoreSection() {
  return (
    <section
      id="score"
      aria-labelledby="score-title"
      className="scroll-mt-16 border-t"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading
          id="score-title"
          eyebrow="Score financiero"
          title="Tu salud financiera en un número de 0 a 100"
          description="El score combina siete factores calculados sobre tus propios registros. Si un factor no aplica, por ejemplo porque no tienes tarjetas, se excluye y los demás se reescalan."
        />

        <div className="grid gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h3 className="font-medium">Factores y pesos</h3>
            <ul className="flex flex-col gap-4">
              {FACTORS.map((factor) => (
                <li
                  key={factor.label}
                  className="flex flex-col gap-1.5"
                >
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="font-medium">{factor.label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {factor.weight} %
                    </span>
                  </div>
                  <div
                    aria-hidden="true"
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full bg-(--income)"
                      style={{
                        width: `${(factor.weight / MAX_WEIGHT) * 100}%`
                      }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {factor.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <h3 className="font-medium">Bandas</h3>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {BANDS.map((band) => (
                  <li
                    key={band.label}
                    className={cn(
                      "flex flex-col gap-0.5 rounded-lg px-3 py-2",
                      band.className
                    )}
                  >
                    <span className="text-sm font-medium">{band.label}</span>
                    <span className="text-xs tabular-nums">{band.range}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              El score se recalcula cada vez que registras algo y muestra su
              evolución mes a mes. Junto a él, las recomendaciones te dicen qué
              hacer, en qué dato se basan y dónde resolverlo.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
