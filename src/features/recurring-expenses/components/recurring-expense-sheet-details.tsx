import { CategoryBadge } from "@/features/categories/components/category-badge"
import { frequencyLabel, validityLabel } from "../occurrences"
import type { RecurringExpense } from "../queries"

/** Categoría, frecuencia y vigencia de un gasto fijo, en su Sheet */
export function RecurringExpenseSheetDetails({
  expense
}: {
  expense: RecurringExpense
}) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Categoría</dt>
      <dd className="min-w-0">
        <CategoryBadge
          name={
            expense.category.archived_at
              ? `${expense.category.name} (archivada)`
              : expense.category.name
          }
          icon={expense.category.icon}
          color={expense.category.color}
        />
      </dd>
      <dt className="text-muted-foreground">Frecuencia</dt>
      <dd>{frequencyLabel(expense)}</dd>
      <dt className="text-muted-foreground">Vigencia</dt>
      <dd>{validityLabel(expense)}</dd>
    </dl>
  )
}
