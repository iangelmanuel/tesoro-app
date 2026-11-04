import { TriangleAlert } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { formatPercent } from "@/features/budgets/progress"
import { formatDate } from "@/libs/format"
import {
  goalPercent,
  goalRemaining,
  goalStatus,
  isOverdue,
  isReached,
  suggestedMonthly
} from "../progress"
import type { Goal } from "../queries"
import { GoalProgressBar } from "./goal-progress-bar"

interface GoalSummaryProps {
  goal: Goal
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  currency: string
}

/**
 * Barra, porcentaje, faltante, fecha objetivo, aporte sugerido y aviso de
 * fecha vencida. Lo comparten la tarjeta y el Sheet de la meta.
 */
export function GoalSummary({ goal, today, currency }: GoalSummaryProps) {
  const status = goalStatus(goal, today)
  const percent = goalPercent(goal.saved, goal.target_amount)
  const remaining = goalRemaining(goal.saved, goal.target_amount)
  const suggested = suggestedMonthly(goal, today)

  return (
    <>
      <div className="flex items-center gap-3">
        <GoalProgressBar
          percent={percent}
          status={status}
        />
        <span className="shrink-0 text-sm font-medium whitespace-nowrap tabular-nums">
          {formatPercent(percent)}
        </span>
      </div>

      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-start sm:justify-start">
          <dt className="text-muted">Faltan</dt>
          <dd className="text-right font-medium whitespace-nowrap tabular-nums sm:text-left">
            <Amount
              value={remaining}
              currency={currency}
            />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-start sm:justify-start">
          <dt className="text-muted">Fecha objetivo</dt>
          <dd className="text-right font-medium whitespace-nowrap sm:text-left">
            {goal.target_date
              ? formatDate(goal.target_date)
              : "Sin fecha objetivo"}
          </dd>
        </div>
        {/* Solo en activas. Al llegar al 100 % el aviso "¡Lo lograste!"
            reemplaza al aporte sugerido */}
        {goal.status === "active" && suggested !== null && !isReached(goal) && (
          <div className="flex items-baseline justify-between gap-2 sm:col-span-2 sm:flex-col sm:items-start sm:justify-start">
            <dt className="min-w-0 text-muted">Aporte mensual sugerido</dt>
            <dd className="text-right font-medium whitespace-nowrap tabular-nums sm:text-left">
              <Amount
                value={suggested}
                currency={currency}
              />
            </dd>
          </div>
        )}
      </dl>

      {isOverdue(goal, today) && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <TriangleAlert className="size-4 shrink-0" />
          La fecha objetivo ya pasó
        </p>
      )}
    </>
  )
}
