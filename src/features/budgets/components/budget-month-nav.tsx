import { MonthNav } from "@/components/dashboard/month-nav"
import type { BudgetMonth } from "../month"
import { BUDGETS_PATH } from "../tabs"

interface BudgetMonthNavProps {
  month: BudgetMonth
}

// Escribe `?month`. La tab Presupuestos es la de por defecto: no hace falta
// `?tab`.
export function BudgetMonthNav({ month }: BudgetMonthNavProps) {
  return (
    <MonthNav
      path={BUDGETS_PATH}
      label={month.label}
      prev={month.prev}
      next={month.next}
      data-tour="budgets-month"
    />
  )
}
