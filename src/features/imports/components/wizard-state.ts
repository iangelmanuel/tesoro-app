import {
  detectTables,
  matchTable,
  suggestMapping,
  suggestTypeMode
} from "../detect"
import {
  type ExtractedRow,
  type SourceTable,
  accountValues,
  categoryPairs,
  distinctValues,
  extractRows,
  linkValues,
  suggestAccountTargets,
  suggestCategoryTargets,
  suggestLinkTargets,
  suggestTypeValue
} from "../normalize"
import {
  type ExtractedDebtEntryRow,
  extractDebtEntryRows,
  suggestDebtEntryValue
} from "../normalize-debt-entries"
import {
  type ExtractedGoalContributionRow,
  extractGoalContributionRows,
  suggestGoalEntryValue
} from "../normalize-goal-contributions"
import {
  type ExtractedRecurringRow,
  extractRecurringRows,
  suggestFrequencyValue
} from "../normalize-recurring"
import type { SheetCells } from "../read-file"
import { DEFAULT_TARGET } from "../targets"
import type {
  AccountOption,
  AccountTarget,
  CategoryOption,
  CategoryTarget,
  DateFormat,
  DebtEntryTarget,
  DebtEntryValue,
  DetectedTable,
  EntryTypeMode,
  FrequencyTarget,
  GoalContributionValue,
  GoalEntryTarget,
  ImportConfig,
  ImportField,
  ImportStats,
  ImportTarget,
  LinkTarget,
  PreviewRow,
  RecurringValue,
  TransactionValue,
  TypeMode,
  TypeValueTarget
} from "../types"

// Estado del asistente de importación (SPEC 08 y 08b). Vive en el cliente y
// se pierde al recargar.

export const STEPS = [
  { id: "file", label: "Archivo" },
  { id: "table", label: "Tabla" },
  { id: "columns", label: "Columnas" },
  { id: "categories", label: "Categorías" },
  { id: "preview", label: "Vista previa" },
  { id: "summary", label: "Resumen" }
] as const

export type StepId = (typeof STEPS)[number]["id"]

/** Nombre del paso 4 según el destino */
export function stepLabel(step: StepId, target: ImportTarget) {
  if (step !== "categories") {
    return STEPS.find((item) => item.id === step)?.label ?? step
  }
  if (target === "debt_entries") return "Deudas"
  if (target === "goal_contributions") return "Metas"
  return "Categorías"
}

/** Filas de la vista previa según el destino */
export type PreviewState = { empty: number } & (
  | { target: "transactions"; rows: PreviewRow<TransactionValue>[] }
  | { target: "recurring_expenses"; rows: PreviewRow<RecurringValue>[] }
  | { target: "debt_entries"; rows: PreviewRow<DebtEntryValue>[] }
  | {
      target: "goal_contributions"
      rows: PreviewRow<GoalContributionValue>[]
    }
)

/** Filas leídas con el mapeo de columnas, según el destino */
export type Extracted =
  | { target: "transactions"; rows: ExtractedRow[]; empty: number }
  | {
      target: "recurring_expenses"
      rows: ExtractedRecurringRow[]
      empty: number
    }
  | { target: "debt_entries"; rows: ExtractedDebtEntryRow[]; empty: number }
  | {
      target: "goal_contributions"
      rows: ExtractedGoalContributionRow[]
      empty: number
    }

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

export interface LoadedFile {
  name: string
  /** true para .csv: una sola hoja y `sheets` vacío al guardar */
  isCsv: boolean
  sheets: SheetCells[]
  /** Tablas detectadas por hoja */
  detected: Record<string, DetectedTable[]>
}

export interface WizardState {
  step: StepId
  /** Destino de la importación; cambiarlo reinicia el mapeo */
  target: ImportTarget
  file: LoadedFile | null
  /** Hojas marcadas, en el orden del archivo. La primera define el mapeo */
  selectedSheets: string[]
  /** Tabla elegida o ajustada en la primera hoja marcada */
  primaryTable: DetectedTable | null
  /** Mapeo de columnas y tipo; null hasta entrar al paso 3 */
  config: ImportConfig | null
  /** Encabezados con los que se armó `config`, para rehacerlo si cambian */
  configHeaders: string | null
  /** Clave del par (tipo, valor de origen) → destino */
  categoryTargets: Record<string, CategoryTarget>
  /** Valor normalizado de la columna Método → cuenta (movimientos) */
  accountTargets: Record<string, AccountTarget>
  /** Valor normalizado de la columna de deuda o meta → destino */
  linkTargets: Record<string, LinkTarget>
  /** Filas de la vista previa ya con duplicados marcados */
  preview: PreviewState | null
  /** Stats de la importación confirmada */
  summary: ImportStats | null
}

export type WizardAction =
  | { type: "set_target"; target: ImportTarget }
  | { type: "file_loaded"; name: string; sheets: SheetCells[] }
  | { type: "toggle_sheet"; sheet: string }
  | { type: "set_primary_table"; table: DetectedTable }
  | { type: "start_columns" }
  | { type: "set_field"; field: ImportField; column: number | undefined }
  | { type: "set_type_mode"; mode: TypeMode }
  | { type: "set_date_format"; format: DateFormat }
  | { type: "set_type_value"; key: string; target: TypeValueTarget | undefined }
  | { type: "set_entry_type_mode"; mode: EntryTypeMode }
  | {
      type: "set_entry_type_value"
      key: string
      target: DebtEntryTarget | GoalEntryTarget | undefined
    }
  | {
      type: "set_frequency_value"
      key: string
      target: FrequencyTarget | undefined
    }
  | { type: "set_fixed_link"; id: string | null }
  | {
      type: "start_categories"
      categories: CategoryOption[]
      accounts: AccountOption[]
    }
  | { type: "set_category_target"; key: string; target: CategoryTarget }
  | { type: "set_account_target"; key: string; target: AccountTarget }
  | { type: "start_links"; options: { id: string; name: string }[] }
  | { type: "set_link_target"; key: string; target: LinkTarget }
  | { type: "preview_ready"; preview: PreviewState }
  | { type: "toggle_row"; index: number }
  | { type: "imported"; stats: ImportStats }
  | { type: "go_to"; step: StepId }
  | { type: "reset" }

export const INITIAL_STATE: WizardState = {
  step: "file",
  target: DEFAULT_TARGET,
  file: null,
  selectedSheets: [],
  primaryTable: null,
  config: null,
  configHeaders: null,
  categoryTargets: {},
  accountTargets: {},
  linkTargets: {},
  preview: null,
  summary: null
}

/** Estado inicial con el destino de `?target=` */
export function initialState(target: ImportTarget): WizardState {
  return { ...INITIAL_STATE, target }
}

/** Agrega o quita el destino de un valor */
function withValue<T>(values: Record<string, T>, key: string, target?: T) {
  const next = { ...values }
  if (target === undefined) delete next[key]
  else next[key] = target
  return next
}

function firstTable(file: LoadedFile, sheet: string | undefined) {
  return sheet ? (file.detected[sheet]?.[0] ?? null) : null
}

/**
 * Agrega a `values` la sugerencia de cada valor nuevo de la columna. Los que
 * ya tienen destino no cambian.
 */
function seedColumnValues<T>(
  state: WizardState,
  column: number | undefined,
  values: Record<string, T>,
  suggest: (label: string) => T | undefined
) {
  if (column === undefined) return values

  const seeded = { ...values }
  for (const { key, label } of distinctValues(sourceTables(state), column)) {
    if (key in seeded) continue
    const suggestion = suggest(label)
    if (suggestion) seeded[key] = suggestion
  }
  return seeded
}

/**
 * Sugiere el destino de los valores nuevos de las columnas de tipo (ingreso o
 * gasto; pago, cargo, aporte o retiro) y de frecuencia
 */
function seedValues(state: WizardState, config: ImportConfig): ImportConfig {
  const { mapping } = config

  switch (state.target) {
    case "transactions":
      return {
        ...config,
        typeValues: seedColumnValues(
          state,
          mapping.type,
          config.typeValues,
          suggestTypeValue
        )
      }
    case "recurring_expenses":
      return {
        ...config,
        frequencyValues: seedColumnValues(
          state,
          mapping.frequency,
          config.frequencyValues,
          suggestFrequencyValue
        )
      }
    case "debt_entries":
    case "goal_contributions":
      return {
        ...config,
        entryTypeValues: seedColumnValues<DebtEntryTarget | GoalEntryTarget>(
          state,
          mapping.entry_type,
          config.entryTypeValues,
          state.target === "debt_entries"
            ? suggestDebtEntryValue
            : suggestGoalEntryValue
        )
      }
  }
}

export function wizardReducer(
  state: WizardState,
  action: WizardAction
): WizardState {
  switch (action.type) {
    case "set_target":
      if (action.target === state.target) return state
      return {
        ...state,
        target: action.target,
        config: null,
        configHeaders: null,
        categoryTargets: {},
        accountTargets: {},
        linkTargets: {},
        preview: null
      }

    case "file_loaded": {
      const detected = Object.fromEntries(
        action.sheets.map((sheet) => [
          sheet.name,
          detectTables(sheet.cells, sheet.name)
        ])
      )
      const file: LoadedFile = {
        name: action.name,
        isCsv: action.name.toLowerCase().endsWith(".csv"),
        sheets: action.sheets,
        detected
      }
      // Se marca la primera hoja con alguna tabla
      const first =
        action.sheets.find((sheet) => detected[sheet.name].length > 0) ??
        action.sheets[0]

      return {
        ...INITIAL_STATE,
        step: "table",
        target: state.target,
        file,
        selectedSheets: [first.name],
        primaryTable: firstTable(file, first.name)
      }
    }

    case "toggle_sheet": {
      if (!state.file) return state

      const selected = new Set(state.selectedSheets)
      if (selected.has(action.sheet)) selected.delete(action.sheet)
      else selected.add(action.sheet)

      const selectedSheets = state.file.sheets
        .map((sheet) => sheet.name)
        .filter((name) => selected.has(name))
      const primaryChanged = selectedSheets[0] !== state.selectedSheets[0]

      return {
        ...state,
        selectedSheets,
        primaryTable: primaryChanged
          ? firstTable(state.file, selectedSheets[0])
          : state.primaryTable
      }
    }

    case "set_primary_table":
      return { ...state, primaryTable: action.table }

    case "start_columns": {
      if (!state.primaryTable) return state

      const headers = state.primaryTable.headers.join("\u0000")
      if (state.config && state.configHeaders === headers) {
        return { ...state, step: "columns" }
      }

      const mapping = suggestMapping(state.primaryTable.headers, state.target)
      const config = seedValues(state, {
        mapping,
        typeMode: suggestTypeMode(mapping),
        dateFormat: "dmy",
        typeValues: {},
        entryTypeMode: mapping.entry_type === undefined ? "sign" : "column",
        entryTypeValues: {},
        frequencyValues: {},
        fixedLinkId: null
      })

      return {
        ...state,
        step: "columns",
        config,
        configHeaders: headers,
        categoryTargets: {},
        accountTargets: {},
        linkTargets: {}
      }
    }

    case "set_field": {
      if (!state.config) return state

      // Cada columna va a un solo campo
      const mapping = Object.fromEntries(
        Object.entries(state.config.mapping).filter(
          ([field, column]) =>
            field !== action.field && column !== action.column
        )
      )
      if (action.column !== undefined) mapping[action.field] = action.column

      return {
        ...state,
        config: seedValues(state, { ...state.config, mapping })
      }
    }

    case "set_type_mode":
      return state.config
        ? { ...state, config: { ...state.config, typeMode: action.mode } }
        : state

    case "set_date_format":
      return state.config
        ? { ...state, config: { ...state.config, dateFormat: action.format } }
        : state

    case "set_type_value": {
      if (!state.config) return state

      const typeValues = withValue(
        state.config.typeValues,
        action.key,
        action.target
      )
      return { ...state, config: { ...state.config, typeValues } }
    }

    case "set_entry_type_mode":
      return state.config
        ? {
            ...state,
            config: seedValues(state, {
              ...state.config,
              entryTypeMode: action.mode
            })
          }
        : state

    case "set_entry_type_value": {
      if (!state.config) return state

      const entryTypeValues = withValue(
        state.config.entryTypeValues,
        action.key,
        action.target
      )
      return { ...state, config: { ...state.config, entryTypeValues } }
    }

    case "set_frequency_value": {
      if (!state.config) return state

      const frequencyValues = withValue(
        state.config.frequencyValues,
        action.key,
        action.target
      )
      return { ...state, config: { ...state.config, frequencyValues } }
    }

    case "set_fixed_link":
      return state.config
        ? { ...state, config: { ...state.config, fixedLinkId: action.id } }
        : state

    case "start_categories": {
      if (!state.config) return state

      // Se conservan las elecciones de pares que ya se habían mapeado
      const extracted = extractForTarget(
        state.target,
        sourceTables(state),
        state.config
      )
      const suggested = suggestCategoryTargets(
        extractedPairs(extracted),
        action.categories
      )
      const suggestedAccounts = suggestAccountTargets(
        extractedAccountValues(extracted),
        action.accounts
      )

      return {
        ...state,
        step: "categories",
        categoryTargets: { ...suggested, ...state.categoryTargets },
        accountTargets: { ...suggestedAccounts, ...state.accountTargets }
      }
    }

    case "start_links": {
      if (!state.config) return state

      // Se conservan las elecciones de valores que ya se habían mapeado
      const extracted = extractForTarget(
        state.target,
        sourceTables(state),
        state.config
      )
      const suggested = suggestLinkTargets(
        extractedLinkValues(extracted),
        action.options
      )

      return {
        ...state,
        step: "categories",
        linkTargets: { ...suggested, ...state.linkTargets }
      }
    }

    case "set_link_target":
      return {
        ...state,
        linkTargets: { ...state.linkTargets, [action.key]: action.target }
      }

    case "set_category_target":
      return {
        ...state,
        categoryTargets: {
          ...state.categoryTargets,
          [action.key]: action.target
        }
      }

    case "set_account_target":
      return {
        ...state,
        accountTargets: {
          ...state.accountTargets,
          [action.key]: action.target
        }
      }

    case "preview_ready":
      return { ...state, step: "preview", preview: action.preview }

    case "toggle_row": {
      const row = state.preview?.rows[action.index]
      // Las filas con error u omitidas no se pueden marcar
      if (!state.preview || !row?.value) return state

      const rows: PreviewRow<unknown>[] = [...state.preview.rows]
      rows[action.index] = { ...row, selected: !row.selected }
      // Las filas siguen siendo del mismo destino
      return {
        ...state,
        preview: { ...state.preview, rows } as PreviewState
      }
    }

    case "imported":
      return { ...state, step: "summary", summary: action.stats }

    case "go_to":
      return { ...state, step: action.step }

    // "Importar otro archivo" conserva el destino
    case "reset":
      return { ...INITIAL_STATE, target: state.target }
  }
}

export interface SheetTable {
  sheet: SheetCells
  /** null: los encabezados no coinciden con los de la primera hoja */
  table: DetectedTable | null
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

export function sourceTables(state: WizardState): SourceTable[] {
  return toSourceTables(selectedTables(state))
}
