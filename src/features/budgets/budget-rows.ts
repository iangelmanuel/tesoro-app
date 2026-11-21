import type { Category } from "@/features/categories/queries"
import type { BudgetProgress } from "./queries"

/** Fila de progreso de una categoría que sí tiene presupuesto en el mes */
export type BudgetedRow = BudgetProgress & {
  budgetId: string
  budgetAmount: number
}

/** La categoría tiene presupuesto en el mes */
export function isBudgeted(row: BudgetProgress): row is BudgetedRow {
  return row.budgetId !== null && row.budgetAmount !== null
}

/**
 * Categorías que el selector de un presupuesto nuevo puede ofrecer: de
 * gasto, activas y sin presupuesto en el mes
 */
export function availableBudgetCategories(
  categories: Category[],
  budgets: Pick<BudgetedRow, "categoryId">[]
) {
  const budgetedIds = new Set(budgets.map((row) => row.categoryId))
  return categories.filter(
    (category) =>
      category.type === "expense" &&
      category.archived_at === null &&
      !budgetedIds.has(category.id)
  )
}
