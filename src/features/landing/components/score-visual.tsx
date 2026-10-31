import { cn } from "@/libs/utils"

// Mockup interino con datos ficticios fijos. El spec de videos de la landing
// lo reemplaza; no depende de nada fuera de este archivo
const SCORE = 72

const RECOMMENDATIONS = [
  {
    title: "Tu gasto en restaurantes subió 38 %",
    detail: "Frente al promedio de los últimos 3 meses.",
    color: "bg-(--expense)"
  },
  {
    title: "Paga primero la tarjeta con mayor tasa",
    detail: "Ahorras intereses sin cambiar tu cuota total.",
    color: "bg-amber-500"
  },
  {
    title: "Tu colchón cubre 1,5 meses de gastos",
    detail: "Apunta a 3 meses con un aporte fijo mensual.",
    color: "bg-(--balance)"
  }
]

export function LandingScoreVisual() {
  return (
    <figure>
      <figcaption className="sr-only">
        Ejemplo de score financiero: 72 de 100, banda Bueno, con tres
        recomendaciones sobre gasto en restaurantes, orden de pago de tarjetas y
        colchón de emergencia.
      </figcaption>
      <div
        aria-hidden="true"
        className="flex flex-col gap-6 rounded-2xl border bg-card p-4 shadow-xl shadow-black/5 sm:p-6 dark:shadow-black/40"
      >
        <div className="flex flex-col items-center gap-2">
          <svg
            viewBox="0 0 120 68"
            className="w-48"
          >
            <path
              d="M10 60a50 50 0 0 1 100 0"
              fill="none"
              stroke="var(--muted)"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M10 60a50 50 0 0 1 100 0"
              fill="none"
              stroke="var(--balance)"
              strokeWidth="10"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${SCORE} 100`}
            />
            <text
              x="60"
              y="56"
              textAnchor="middle"
              className="fill-foreground text-[22px] font-semibold"
            >
              {SCORE}
            </text>
          </svg>
          <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-300">
            Bueno
          </span>
          <span className="text-xs text-muted-foreground">
            +4 pts vs. el mes anterior
          </span>
        </div>

        <ul className="flex flex-col gap-3">
          {RECOMMENDATIONS.map((item) => (
            <li
              key={item.title}
              className="flex gap-3 rounded-lg border bg-background p-3"
            >
              <span
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  item.color
                )}
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{item.title}</span>
                <span className="text-xs text-muted-foreground">
                  {item.detail}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  )
}
