import { MonthSwitcherSkeleton } from "@/components/dashboard/month-switcher"
import { Skeleton } from "@/components/ui/skeleton"
import { BudgetProgressListSkeleton } from "./budget-progress-row"
import { BudgetTotalsSkeleton } from "./budget-totals"
import { BudgetsAndRecurringTabsSkeleton } from "./budgets-and-recurring-tabs"

/**
 * Presupuestos mientras carga: selector del teléfono, mes y acciones, KPIs
 * y la lista, con los mismos contenedores que el contenido
 */
export function BudgetsScreenSkeleton() {
  return (
    <>
      <BudgetsAndRecurringTabsSkeleton />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthSwitcherSkeleton />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-11 w-48 rounded-4xl" />
          <Skeleton className="h-11 w-44 rounded-4xl" />
        </div>
      </div>
      <BudgetTotalsSkeleton />
      <BudgetProgressListSkeleton />
    </>
  )
}
