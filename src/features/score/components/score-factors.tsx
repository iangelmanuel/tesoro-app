import { isIncluded } from "../curves"
import type { FactorResult } from "../types"

const PERCENT_FORMAT = new Intl.NumberFormat("es-CO", {
  style: "percent",
  maximumFractionDigits: 1
})

const DECIMAL_FORMAT = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 1
})

/** El dato del factor: meses para colchón o liquidez, porcentaje el resto */
function formatFactorValue(value: number, inMonths: boolean) {
  if (inMonths) {
    return `${DECIMAL_FORMAT.format(value)} ${value === 1 ? "mes" : "meses"}`
  }
  return PERCENT_FORMAT.format(value)
}

interface ScoreFactorsProps<K extends string> {
  factors: FactorResult<K>[]
  /** Nombre visible de cada factor del espacio */
  labels: Record<K, string>
  /** Factores cuyo dato está en meses */
  monthFactors: readonly K[]
}

/** Cada factor con peso, dato, barra de puntos o motivo de exclusión */
export function ScoreFactors<K extends string>({
  factors,
  labels,
  monthFactors
}: ScoreFactorsProps<K>) {
  return (
    <ul className="flex flex-col divide-y">
      {factors.map((factor) => {
        const label = labels[factor.key]

        return (
          <li
            key={factor.key}
            className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">
                Peso {factor.weight}
              </p>
              {isIncluded(factor) ? (
                <p className="ml-auto text-sm tabular-nums">
                  <span className="text-muted-foreground">
                    {formatFactorValue(
                      factor.value,
                      monthFactors.includes(factor.key)
                    )}{" "}
                    ·{" "}
                  </span>
                  <span className="font-medium">
                    {Math.round(factor.points)} pts
                  </span>
                </p>
              ) : (
                <p className="ml-auto text-sm text-muted-foreground">
                  Excluido
                </p>
              )}
            </div>
            {isIncluded(factor) ? (
              <div
                role="progressbar"
                aria-label={`${label}: ${Math.round(factor.points)} de 100 puntos`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(factor.points)}
                className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${factor.points}%` }}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{factor.excluded}</p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
