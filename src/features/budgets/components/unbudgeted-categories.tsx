import { Button, Card, CardContent } from "@heroui/react"
import { Plus } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { CardHeading } from "@/components/dashboard/card-heading"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import type { BudgetMonth } from "../month"
import type { BudgetProgress } from "../queries"
import { BudgetDialog } from "./budget-dialog"

// categoría | monto | acción. En el teléfono la acción es solo el ícono
const UNBUDGETED_GRID =
  "grid-cols-[minmax(0,1fr)_6.5rem_2.75rem] sm:grid-cols-[minmax(0,1fr)_8rem_8.5rem]"

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
            <Amount
              value={total}
              currency={currency}
            />{" "}
            gastados
          </p>
        }
      />
      <CardContent>
        <ul className={CARD_LIST}>
          {rows.map((row) => (
            // Tres columnas fijas: categoría (envuelve), monto a la derecha y
            // acción de ancho constante, así los montos quedan alineados
            <li
              key={row.categoryId}
              className={`grid ${UNBUDGETED_GRID} items-center gap-3 ${CARD_ROW}`}
            >
              <div className="min-w-0">
                <CategoryBadge
                  name={row.archived ? `${row.name} (archivada)` : row.name}
                  icon={row.icon}
                  color={row.color}
                  className="max-w-full min-w-0 shrink break-words whitespace-normal"
                />
              </div>
              <p className="text-right font-medium whitespace-nowrap tabular-nums">
                <Amount
                  value={row.spent}
                  currency={currency}
                />
              </p>
              {/* Una categoría archivada no se puede presupuestar: la celda
                  queda vacía para no mover las demás columnas */}
              {row.archived ? (
                <span aria-hidden="true" />
              ) : (
                <BudgetDialog
                  month={month}
                  categories={categories}
                  defaultCategoryId={row.categoryId}
                  trigger={
                    <Button
                      size="sm"
                      variant="secondary"
                      fullWidth
                      aria-label={`Presupuestar ${row.name}`}
                      className="min-h-11 md:min-h-8"
                    >
                      <Plus />
                      <span className="max-sm:sr-only">Presupuestar</span>
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
