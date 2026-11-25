import { matchTable } from "../detect"
import { extractDebtEntryRows } from "../normalize-debt-entries"
import { extractGoalContributionRows } from "../normalize-goal-contributions"
import { extractRecurringRows } from "../normalize-recurring"
import {
  accountValues,
  categoryPairs,
  extractRows
} from "../normalize-transactions"
import { type SourceTable, linkValues } from "../normalize-values"
import type { ImportConfig, ImportTarget } from "../types"
import {
  type Extracted,
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
