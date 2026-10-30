import {
  detectTables,
  matchTable,
  suggestMapping,
  suggestTypeMode
} from "../detect"
import {
  type SourceTable,
  categoryPairs,
  distinctValues,
  extractRows,
  suggestCategoryTargets,
  suggestTypeValue
} from "../normalize"
import type { SheetCells } from "../read-file"
import { DEFAULT_TARGET } from "../targets"
import type {
  CategoryOption,
  CategoryTarget,
  DateFormat,
  DetectedTable,
  ImportConfig,
  ImportField,
  ImportStats,
  ImportTarget,
  PreviewRow,
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
  /** Filas de la vista previa ya con duplicados marcados */
  preview: { rows: PreviewRow[]; empty: number } | null
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
  | { type: "start_categories"; categories: CategoryOption[] }
  | { type: "set_category_target"; key: string; target: CategoryTarget }
  | { type: "preview_ready"; rows: PreviewRow[]; empty: number }
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
  preview: null,
  summary: null
}

function firstTable(file: LoadedFile, sheet: string | undefined) {
  return sheet ? (file.detected[sheet]?.[0] ?? null) : null
}

/** Sugiere ingreso o gasto para los valores nuevos de la columna de tipo */
function seedTypeValues(state: WizardState, config: ImportConfig) {
  if (config.mapping.type === undefined) return config

  const typeValues = { ...config.typeValues }
  for (const { key, label } of distinctValues(
    sourceTables(state),
    config.mapping.type
  )) {
    if (key in typeValues) continue
    const suggestion = suggestTypeValue(label)
    if (suggestion) typeValues[key] = suggestion
  }

  return { ...config, typeValues }
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
      const config = seedTypeValues(state, {
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
        categoryTargets: {}
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
        config: seedTypeValues(state, { ...state.config, mapping })
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

      const typeValues = { ...state.config.typeValues }
      if (action.target) typeValues[action.key] = action.target
      else delete typeValues[action.key]

      return { ...state, config: { ...state.config, typeValues } }
    }

    case "start_categories": {
      if (!state.config) return state

      // Se conservan las elecciones de pares que ya se habían mapeado
      const { rows } = extractRows(sourceTables(state), state.config)
      const suggested = suggestCategoryTargets(
        categoryPairs(rows),
        action.categories
      )

      return {
        ...state,
        step: "categories",
        categoryTargets: { ...suggested, ...state.categoryTargets }
      }
    }

    case "set_category_target":
      return {
        ...state,
        categoryTargets: {
          ...state.categoryTargets,
          [action.key]: action.target
        }
      }

    case "preview_ready":
      return {
        ...state,
        step: "preview",
        preview: { rows: action.rows, empty: action.empty }
      }

    case "toggle_row": {
      const row = state.preview?.rows[action.index]
      // Las filas con error u omitidas no se pueden marcar
      if (!state.preview || !row?.value) return state

      const rows = [...state.preview.rows]
      rows[action.index] = { ...row, selected: !row.selected }
      return { ...state, preview: { ...state.preview, rows } }
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
