import { formatCurrency } from "@/libs/format"
import { cn } from "@/libs/utils"

// Mockup interino con datos ficticios fijos. El spec de videos de la landing
// lo reemplaza; no depende de nada fuera de este archivo
const STATS = [
  { label: "Ingresos", amount: 4_200_000, color: "bg-(--income)" },
  { label: "Gastos", amount: 3_150_000, color: "bg-(--expense)" },
  { label: "Balance", amount: 1_050_000, color: "bg-(--balance)" }
]

const MONTHS = [
  { month: "may", income: 3.6, expense: 3.3 },
  { month: "jun", income: 3.8, expense: 3.5 },
  { month: "jul", income: 3.7, expense: 3.0 },
  { month: "ago", income: 4.0, expense: 3.4 },
  { month: "sep", income: 4.1, expense: 3.2 },
  { month: "oct", income: 4.2, expense: 3.15 }
]

const MAX = Math.max(...MONTHS.map((item) => item.income))

export function LandingHeroVisual() {
  return (
    <figure className="relative">
      <figcaption className="sr-only">
        Ejemplo del resumen de Tesoro: ingresos, gastos y balance del mes, y una
        gráfica de barras de ingresos contra gastos de los últimos seis meses.
      </figcaption>
      <div
        aria-hidden="true"
        className="rounded-2xl border bg-card p-4 shadow-xl shadow-black/5 sm:p-6 dark:shadow-black/40"
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-muted-foreground/30" />
            <span className="size-2.5 rounded-full bg-muted-foreground/30" />
            <span className="size-2.5 rounded-full bg-muted-foreground/30" />
          </div>
          <span className="text-xs text-muted-foreground">
            Resumen · octubre
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="flex min-w-0 flex-col gap-1 rounded-lg border bg-background p-2.5 sm:p-3"
            >
              <span className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground sm:text-xs">
                <span className={cn("size-2 rounded-full", stat.color)} />
                {stat.label}
              </span>
              <span className="truncate text-xs font-semibold tabular-nums sm:text-sm">
                {formatCurrency(stat.amount)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg border bg-background p-3 sm:p-4">
          <div className="flex h-36 items-end justify-between gap-2 sm:h-44">
            {MONTHS.map((item) => (
              <div
                key={item.month}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
              >
                <div className="flex h-full w-full items-end justify-center gap-0.5 sm:gap-1">
                  <div
                    className="w-1/2 max-w-3 rounded-t-sm bg-(--income)"
                    style={{ height: `${(item.income / MAX) * 100}%` }}
                  />
                  <div
                    className="w-1/2 max-w-3 rounded-t-sm bg-(--expense)"
                    style={{ height: `${(item.expense / MAX) * 100}%` }}
                  />
                </div>
                <span className="text-[0.7rem] text-muted-foreground">
                  {item.month}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </figure>
  )
}
