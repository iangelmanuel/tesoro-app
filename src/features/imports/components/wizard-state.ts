import { detectTables, matchTable } from "../detect"
import type { SheetCells } from "../read-file"
import type { DetectedTable } from "../types"

// Estado del asistente de importación (SPEC 08). Vive en el cliente y se
// pierde al recargar.

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
  file: LoadedFile | null
  /** Hojas marcadas, en el orden del archivo. La primera define el mapeo */
  selectedSheets: string[]
  /** Tabla elegida o ajustada en la primera hoja marcada */
  primaryTable: DetectedTable | null
}

export type WizardAction =
  | { type: "file_loaded"; name: string; sheets: SheetCells[] }
  | { type: "toggle_sheet"; sheet: string }
  | { type: "set_primary_table"; table: DetectedTable }
  | { type: "go_to"; step: StepId }
  | { type: "reset" }

export const INITIAL_STATE: WizardState = {
  step: "file",
  file: null,
  selectedSheets: [],
  primaryTable: null
}

function firstTable(file: LoadedFile, sheet: string | undefined) {
  return sheet ? (file.detected[sheet]?.[0] ?? null) : null
}

export function wizardReducer(
  state: WizardState,
  action: WizardAction
): WizardState {
  switch (action.type) {
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

    case "go_to":
      return { ...state, step: action.step }

    case "reset":
      return INITIAL_STATE
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
export function selectedTables(state: WizardState): SheetTable[] {
  const { file, primaryTable, selectedSheets } = state
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
