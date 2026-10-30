import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { formatCurrency } from "@/libs/format"
import type { BudgetMonth } from "../month"
import type { BudgetProgress } from "../queries"
import { BudgetDialog } from "./budget-dialog"

interface UnbudgetedCategoriesProps {
  /** Categorías de gasto con movimientos en el mes y sin presupuesto */
  rows: BudgetProgress[]
  month: BudgetMonth
  /** Categorías que se pueden presupuestar en el mes */
  categories: Category[]
  currency: string
}

export function UnbudgetedCategories({
  rows,
  month,
  categories,
  currency
}: UnbudgetedCategoriesProps) {
  const total = rows.reduce((sum, row) => sum + row.spent, 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Sin presupuesto</h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {formatCurrency(total, currency)} gastados
        </p>
      </div>
      <ul className="divide-y rounded-xl border">
        {rows.map((row) => (
          <li
            key={row.categoryId}
            className="flex flex-wrap items-center gap-3 p-4"
          >
            <CategoryBadge
              name={row.archived ? `${row.name} (archivada)` : row.name}
              icon={row.icon}
              color={row.color}
            />
            <p className="ml-auto font-medium tabular-nums">
              {formatCurrency(row.spent, currency)}
            </p>
            {/* Una categoría archivada no se puede presupuestar */}
            {!row.archived && (
              <BudgetDialog
                month={month}
                categories={categories}
                defaultCategoryId={row.categoryId}
                trigger={
                  <Button
                    size="sm"
                    variant="outline"
                  >
                    <Plus data-icon="inline-start" />
                    Presupuestar
                  </Button>
                }
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
