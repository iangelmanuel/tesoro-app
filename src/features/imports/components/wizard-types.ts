import type { ExtractedDebtEntryRow } from "../normalize-debt-entries"
import type { ExtractedGoalContributionRow } from "../normalize-goal-contributions"
import type { ExtractedRecurringRow } from "../normalize-recurring"
import type { ExtractedRow } from "../normalize-transactions"
import type { SheetCells } from "../read-file"
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

// Tipos del estado del asistente de importación (SPEC 08 y 08b). El estado
// vive en el cliente y se pierde al recargar.

/** Pasos del asistente, en orden */
export const STEPS = [
  { id: "file", label: "Archivo" },
  { id: "table", label: "Tabla" },
  { id: "columns", label: "Columnas" },
  { id: "categories", label: "Categorías" },
  { id: "preview", label: "Vista previa" },
  { id: "summary", label: "Resumen" }
] as const

/** Id de un paso del asistente */
export type StepId = (typeof STEPS)[number]["id"]

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

/** Archivo leído con las tablas detectadas por hoja */
export interface LoadedFile {
  name: string
  /** true para .csv: una sola hoja y `sheets` vacío al guardar */
  isCsv: boolean
  sheets: SheetCells[]
  /** Tablas detectadas por hoja */
  detected: Record<string, DetectedTable[]>
}

/** Estado del asistente */
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

/** Acciones del reducer del asistente */
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

/** Hoja marcada con su tabla */
export interface SheetTable {
  sheet: SheetCells
  /** null: los encabezados no coinciden con los de la primera hoja */
  table: DetectedTable | null
}
