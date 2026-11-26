import { matchTable } from "../detect"
import { extractDebtEntryRows } from "../normalize-debt-entries"
import { extractGoalContributionRows } from "../normalize-goal-contributions"
import { extractRecurringRows } from "../normalize-recurring"
import {
  accountValues,
  categoryPairs,
  existingAccountKey,
  existingCategoryKey,
  extractRows,
  newAccountKey,
  newCategoryKey
} from "../normalize-transactions"
import { type SourceTable, linkValues } from "../normalize-values"
import type { DebtLinkOption } from "../queries"
import type {
  AccountOption,
  CategoryOption,
  CategoryPair,
  ImportConfig,
  ImportTarget
} from "../types"
import {
  type Extracted,
  type PreviewState,
  STEPS,
  type SheetTable,
  type StepId,
  type WizardState
} from "./wizard-types"

// Datos derivados del estado del asistente: tablas de origen, filas leídas y
// los valores que se mapean en el paso 4. Funciones puras.

/** Nombre del paso 4 según el destino */
export function stepLabel(step: StepId, target: ImportTarget) {
  if (step !== "categories") {
    return STEPS.find((item) => item.id === step)?.label ?? step
  }
  if (target === "debt_entries") return "Deudas"
  if (target === "goal_contributions") return "Metas"
  return "Categorías"
}

/** Lee las filas con el normalizador del destino */
export function extractForTarget(
  target: ImportTarget,
  tables: SourceTable[],
  config: ImportConfig
): Extracted {
  switch (target) {
    case "transactions":
      return { target, ...extractRows(tables, config) }
    case "recurring_expenses":
      return { target, ...extractRecurringRows(tables, config) }
    case "debt_entries":
      return { target, ...extractDebtEntryRows(tables, config) }
    case "goal_contributions":
      return { target, ...extractGoalContributionRows(tables, config) }
  }
}

/** Pares (tipo, valor de categoría) de los destinos que tienen categoría */
export function extractedPairs(extracted: Extracted | null) {
  if (
    extracted?.target === "transactions" ||
    extracted?.target === "recurring_expenses"
  ) {
    return categoryPairs(extracted.rows)
  }
  return []
}

/** Valores de la columna Método (movimientos), con su número de filas */
export function extractedAccountValues(extracted: Extracted | null) {
  return extracted?.target === "transactions"
    ? accountValues(extracted.rows)
    : []
}

/** Valores de la columna de deuda o meta, con su número de filas */
export function extractedLinkValues(extracted: Extracted | null) {
  if (
    extracted?.target === "debt_entries" ||
    extracted?.target === "goal_contributions"
  ) {
    return linkValues(extracted.rows)
  }
  return []
}

/**
 * Tabla de cada hoja marcada: la elegida en la primera y, en las demás, la
 * que tiene los mismos encabezados normalizados.
 */
export function selectedTables({
  file,
  primaryTable,
  selectedSheets
}: Pick<
  WizardState,
  "file" | "primaryTable" | "selectedSheets"
>): SheetTable[] {
  if (!file) return []

  return selectedSheets.flatMap((name, index) => {
    const sheet = file.sheets.find((item) => item.name === name)
    if (!sheet) return []
    if (index === 0) return [{ sheet, table: primaryTable }]
    return [
      {
        sheet,
        table: primaryTable
          ? matchTable(sheet.cells, sheet.name, primaryTable)
          : null
      }
    ]
  })
}

/** Tablas de las hojas incluidas (las que no coinciden se excluyen) */
export function toSourceTables(tables: SheetTable[]): SourceTable[] {
  return tables.flatMap(({ sheet, table }) =>
    table ? [{ table, cells: sheet.cells }] : []
  )
}

/** Tablas de origen de las hojas marcadas */
export function sourceTables(state: WizardState): SourceTable[] {
  return toSourceTables(selectedTables(state))
}

/** Ids distintos de deudas o metas de las filas con datos */
export function linkedIds<V>(
  rows: { value?: V }[],
  idOf: (value: V) => string
) {
  return [
    ...new Set(rows.flatMap((row) => (row.value ? [idOf(row.value)] : [])))
  ]
}

/**
 * Nombre de cada cuenta de destino por clave, para la vista previa. Solo con
 * la columna Método mapeada; si no, undefined (sin columna Cuenta).
 */
export function accountNamesFor(
  state: Pick<WizardState, "config" | "accountTargets">,
  accounts: AccountOption[]
) {
  if (state.config?.mapping.account === undefined) return undefined
  const names: Record<string, string> = {}
  for (const account of accounts) {
    names[existingAccountKey(account.id)] = account.name
  }
  for (const target of Object.values(state.accountTargets)) {
    if (target.kind === "new") {
      names[newAccountKey(target.name)] = `${target.name} (nueva)`
    }
  }
  return names
}

/** Nombre de cada categoría de destino por clave, para la vista previa */
export function categoryNamesFor(
  categories: CategoryOption[],
  pairs: CategoryPair[],
  categoryTargets: WizardState["categoryTargets"]
) {
  const names: Record<string, string> = {}
  for (const category of categories) {
    names[existingCategoryKey(category.id)] = category.name
  }
  for (const pair of pairs) {
    const target = categoryTargets[pair.key]
    if (target?.kind === "new") {
      names[newCategoryKey(pair.type, target.name)] = `${target.name} (nueva)`
    }
  }
  return names
}

/**
 * Algún pago marcado va a un préstamo o cuenta por cobrar: solo ahí aplica
 * la casilla de registrar también el movimiento
 */
export function hasLinkedPayments(
  preview: PreviewState | null,
  debts: Pick<DebtLinkOption, "id" | "kind">[]
) {
  return (
    preview?.target === "debt_entries" &&
    preview.rows.some(
      ({ selected, value }) =>
        selected &&
        value?.kind === "payment" &&
        debts.find((debt) => debt.id === value.debtId)?.kind !== "credit_card"
    )
  )
}

/**
 * Campo de deuda o meta del destino, o null si el destino no tiene. Sin esa
 * columna mapeada, el paso 4 se salta.
 */
export function linkFieldOf(target: ImportTarget) {
  if (target === "debt_entries") return "debt"
  if (target === "goal_contributions") return "goal"
  return null
}

/** Paso al que vuelve la vista previa: el 4, o el 3 si se saltó */
export function previewBackStep(
  target: ImportTarget,
  config: ImportConfig | null
): StepId {
  const linkField = linkFieldOf(target)
  return linkField && config?.mapping[linkField] === undefined
    ? "columns"
    : "categories"
}
