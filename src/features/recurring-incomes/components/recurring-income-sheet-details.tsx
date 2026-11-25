import { CategoryBadge } from "@/features/categories/components/category-badge"
import { formatValidity } from "@/libs/format"
import { incomeFrequencyLabel } from "../occurrences"
import type { RecurringIncome } from "../queries"

/** Categoría, frecuencia, cuenta y vigencia de un ingreso fijo, en su Sheet */
export function RecurringIncomeSheetDetails({
  income
}: {
  income: RecurringIncome
}) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Categoría</dt>
      <dd className="min-w-0">
        <CategoryBadge
          name={
            income.category.archived_at
              ? `${income.category.name} (archivada)`
              : income.category.name
          }
          icon={income.category.icon}
          color={income.category.color}
        />
      </dd>
      <dt className="text-muted-foreground">Frecuencia</dt>
      <dd>{incomeFrequencyLabel(income)}</dd>
      <dt className="text-muted-foreground">Cuenta</dt>
      <dd>{income.accountName ?? "Sin cuenta"}</dd>
      <dt className="text-muted-foreground">Vigencia</dt>
      <dd>{formatValidity(income.starts_on, income.ends_on)}</dd>
    </dl>
  )
}
