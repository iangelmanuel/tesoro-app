import { formatPercent } from "@/features/budgets/progress"
import { paidPercent, utilizationPercent } from "../calculations"
import type { Debt } from "../queries"
import { DebtBar, UtilizationBadge, UtilizationBar } from "./debt-indicators"

/**
 * Utilización (tarjeta) o % pagado (préstamo con monto original). Lo
 * comparten la tarjeta y el Sheet de la deuda.
 */
export function DebtProgress({ debt }: { debt: Debt }) {
  if (debt.kind === "credit_card" && debt.credit_limit !== null) {
    const percent = utilizationPercent(debt.balance, debt.credit_limit)

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <UtilizationBar percent={percent} />
          <span className="text-sm font-medium tabular-nums">
            {formatPercent(percent)}
          </span>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          Utilización del cupo
          <UtilizationBadge percent={percent} />
        </p>
      </div>
    )
  }

  const percent = paidPercent(debt)
  if (percent === null) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <DebtBar percent={percent} />
        <span className="text-sm font-medium tabular-nums">
          {formatPercent(percent)}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">Pagado del monto original</p>
    </div>
  )
}
