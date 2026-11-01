import { Button, Card, CardContent } from "@heroui/react"
import { Plus } from "lucide-react"
import { CardHeading } from "@/components/dashboard/card-heading"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
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
    <Card>
      <CardHeading
        title="Sin presupuesto"
        action={
          <p className="text-sm text-muted tabular-nums">
            {formatCurrency(total, currency)} gastados
          </p>
        }
      />
      <CardContent>
        <ul className={CARD_LIST}>
          {rows.map((row) => (
            <li
              key={row.categoryId}
              className={`flex flex-wrap items-center gap-3 ${CARD_ROW}`}
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
                      variant="secondary"
                    >
                      <Plus />
                      Presupuestar
                    </Button>
                  }
                />
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
