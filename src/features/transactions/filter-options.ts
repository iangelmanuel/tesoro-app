import type { AccountOption } from "@/features/accounts/components/account-select"
import { NO_ACCOUNT } from "@/features/accounts/constants"
import type { Category } from "@/features/categories/queries"
import type { LedgerFilterType } from "./filters"

// Opciones de los selects de filtro de Movimientos. Puro: lo usa
// TransactionsFilters y se prueba sin React.

/** Valor de "Todos" / "Todas" en los selects de filtro */
export const FILTER_ALL = "all"

/** Opción de un select de filtro */
export interface FilterOption {
  id: string
  label: string
}

/** Opciones del filtro de tipo */
export const TYPE_FILTER_OPTIONS: FilterOption[] = [
  { id: FILTER_ALL, label: "Todos" },
  { id: "income", label: "Entradas" },
  { id: "expense", label: "Salidas" },
  { id: "transfer", label: "Traspasos" }
]

// Las archivadas van al final, marcadas, para revisar movimientos históricos
function archivedLast<T extends { archived_at: string | null }>(items: T[]) {
  return items.toSorted(
    (a, b) => Number(a.archived_at !== null) - Number(b.archived_at !== null)
  )
}

function optionLabel(item: { name: string; archived_at: string | null }) {
  return item.archived_at ? `${item.name} (archivada)` : item.name
}

/**
 * Opciones del filtro de categoría. Con tipo elegido solo se ofrecen sus
 * categorías; las archivadas van al final.
 */
export function categoryFilterOptions(
  categories: Pick<Category, "id" | "name" | "type" | "archived_at">[],
  type: LedgerFilterType | undefined
): FilterOption[] {
  const options = archivedLast(
    categories.filter((category) => !type || category.type === type)
  )
  return [
    { id: FILTER_ALL, label: "Todas" },
    ...options.map((category) => ({
      id: category.id,
      label: optionLabel(category)
    }))
  ]
}

/** Opciones del filtro de cuenta: "Sin cuenta" y las archivadas al final */
export function accountFilterOptions(
  accounts: Pick<AccountOption, "id" | "name" | "archived_at">[]
): FilterOption[] {
  return [
    { id: FILTER_ALL, label: "Todas" },
    { id: NO_ACCOUNT, label: "Sin cuenta" },
    ...archivedLast(accounts).map((account) => ({
      id: account.id,
      label: optionLabel(account)
    }))
  ]
}
