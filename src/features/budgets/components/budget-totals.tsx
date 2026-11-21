import {
  StatCard,
  StatCardSkeleton
} from "@/components/dashboard/data/stat-card"
import { TONE_TEXT_CLASSES } from "@/components/dashboard/feedback/tone"
import type { BudgetProgress } from "../queries"

interface BudgetTotalsProps {
  /** Solo filas con presupuesto: así restante = presupuestado − gastado */
  budgets: BudgetProgress[]
  currency: string
}

/** Contenedor de los KPIs y de su skeleton: misma grilla */
const TOTALS_GRID = "grid gap-4 sm:grid-cols-3"

export function BudgetTotals({ budgets, currency }: BudgetTotalsProps) {
  const budgeted = budgets.reduce(
    (sum, row) => sum + (row.budgetAmount ?? 0),
    0
  )
  const spent = budgets.reduce((sum, row) => sum + row.spent, 0)
  const remaining = budgeted - spent

  return (
    <div
      className={TOTALS_GRID}
      data-tour="budgets-totals"
    >
      <StatCard
        label="Presupuestado"
        value={budgeted}
        trend="lower-is-better"
        currency={currency}
      />
      <StatCard
        label="Gastado"
        value={spent}
        trend="lower-is-better"
        currency={currency}
      />
      <StatCard
        label="Restante"
        value={remaining}
        trend="higher-is-better"
        currency={currency}
        valueClassName={remaining < 0 ? TONE_TEXT_CLASSES.danger : undefined}
      />
    </div>
  )
}

/** Los tres KPIs mientras cargan */
export function BudgetTotalsSkeleton() {
  return (
    <div className={TOTALS_GRID}>
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  )
}
