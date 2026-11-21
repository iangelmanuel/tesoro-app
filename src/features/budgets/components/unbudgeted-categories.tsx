import { Plus } from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import { CardHeading } from "@/components/dashboard/data/card-heading"
import { CARD, CARD_LIST, CARD_ROW } from "@/components/dashboard/data/surface"
import { Button } from "@/components/ui/button"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { cn } from "@/libs/cn"
import type { BudgetMonth } from "../month"
import type { BudgetProgress } from "../queries"
import { BudgetDialog } from "./budget-dialog"

// categoría | monto | acción. En el teléfono la acción es solo el ícono
const UNBUDGETED_GRID =
  "grid-cols-[minmax(0,1fr)_6.5rem_2.75rem] sm:grid-cols-[minmax(0,1fr)_8rem_8.5rem]"

interface UnbudgetedCategoriesProps {
  workspaceId: string
  /** Categorías de gasto con movimientos en el mes y sin presupuesto */
  rows: BudgetProgress[]
  month: BudgetMonth
  /** Categorías que se pueden presupuestar en el mes */
  categories: Category[]
  currency: string
}

export function UnbudgetedCategories({
  workspaceId,
  rows,
  month,
  categories,
  currency
}: UnbudgetedCategoriesProps) {
  const total = rows.reduce((sum, row) => sum + row.spent, 0)

  return (
    <section
      aria-label="Sin presupuesto"
      className={CARD}
      data-tour="budgets-unbudgeted"
    >
      <CardHeading
        title="Sin presupuesto"
        action={
          <p className="text-sm text-muted-foreground tabular-nums">
            <Amount
              value={total}
              currency={currency}
            />{" "}
            gastados
          </p>
        }
      />
      <ul className={CARD_LIST}>
        {rows.map((row) => (
          // Tres columnas fijas: categoría (envuelve), monto a la derecha y
          // acción de ancho constante, así los montos quedan alineados
          <li
            key={row.categoryId}
            className={cn("grid items-center gap-3", UNBUDGETED_GRID, CARD_ROW)}
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
                workspaceId={workspaceId}
                month={month}
                categories={categories}
                defaultCategoryId={row.categoryId}
                trigger={
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Presupuestar ${row.name}`}
                    className="w-full"
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
    </section>
  )
}
