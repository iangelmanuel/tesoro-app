import type { Database } from "@/types/database"

export type TransactionType = Database["public"]["Enums"]["transaction_type"]
export type ImportTarget = Database["public"]["Enums"]["import_target"]
export type RecurringFrequency =
  Database["public"]["Enums"]["recurring_frequency"]
export type DebtEntryKind = Database["public"]["Enums"]["debt_entry_kind"]

export type ImportField =
  // Movimientos (SPEC 08)
  | "date"
  | "amount"
  | "type"
  | "income_amount"
  | "expense_amount"
  | "category"
  | "description"
  | "note"
  // Columna Método (SPEC 08c)
  | "account"
  // Gastos fijos, deudas y metas (SPEC 08b)
  | "name"
  | "frequency"
  | "day_of_month"
  | "month_of_year"
  | "starts_on"
  | "ends_on"
  | "entry_type"
  | "debt"
  | "goal"

export type TypeMode = "column" | "sign" | "split" // valores, signo, dos columnas
export type EntryTypeMode = "column" | "sign" | "all" // valores, signo, todas iguales
export type DateFormat = "dmy" | "mdy" | "ymd"

export interface DetectedTable {
  sheet: string
  headerRow: number // índice 0
  startCol: number
  endCol: number // inclusivo
  headers: string[]
}

/** Campo → índice de la columna dentro de la tabla (0 = startCol) */
export type ColumnMapping = Partial<Record<ImportField, number>>

/** Destino de un valor de la columna de tipo */
export type TypeValueTarget = TransactionType | "skip"

export type CategoryTarget =
  | { kind: "existing"; categoryId: string }
  | { kind: "new"; name: string }
  | { kind: "skip" }

/** Cuenta a la que va un valor de la columna Método. No omite filas. */
export type AccountTarget =
  | { kind: "existing"; accountId: string }
  | { kind: "new"; name: string }
  | { kind: "none" }

/** Cuenta activa que se puede elegir como destino */
export interface AccountOption {
  id: string
  name: string
}

/** Valor de la columna Método con su número de filas */
export interface AccountValue {
  key: string
  label: string
  count: number
}

/** Destino de un valor de la columna de frecuencia (gastos fijos) */
export type FrequencyTarget = RecurringFrequency | "skip"

/** Destino de un valor de la columna de tipo en deudas */
export type DebtEntryTarget = "payment" | "charge" | "decrease" | "skip"

/** Destino de un valor de la columna de tipo en metas */
export type GoalEntryTarget = "contribution" | "withdrawal" | "skip"

/** Deuda o meta a la que va un valor de la columna `debt` o `goal` */
export type LinkTarget = { kind: "existing"; id: string } | { kind: "skip" }

/** Categoría que se puede elegir como destino (sin las archivadas) */
export interface CategoryOption {
  id: string
  type: TransactionType
  name: string
}

/** Par (tipo, valor de categoría de origen) con su número de filas */
export interface CategoryPair {
  key: string
  type: TransactionType
  label: string
  count: number
}

export interface ImportConfig {
  mapping: ColumnMapping
  typeMode: TypeMode
  dateFormat: DateFormat
  /** Valor normalizado de la columna de tipo → destino */
  typeValues: Record<string, TypeValueTarget>
  /** Deudas y metas: cómo se sabe el tipo de cada fila */
  entryTypeMode: EntryTypeMode
  /** Valor normalizado de la columna `entry_type` → destino */
  entryTypeValues: Record<string, DebtEntryTarget | GoalEntryTarget>
  /** Valor normalizado de la columna `frequency` → destino */
  frequencyValues: Record<string, FrequencyTarget>
  /** Deuda o meta para todo el archivo cuando no se mapea `debt` ni `goal` */
  fixedLinkId: string | null
}

export type RowStatus = "ready" | "duplicate" | "error" | "skipped"

export interface TransactionValue {
  type: TransactionType
  amount: number
  occurred_on: string
  categoryKey: string
  /** "existing:<id>", "new:<nombre normalizado>" o null sin cuenta */
  accountKey: string | null
  description: string
  note: string | null
}

export interface RecurringValue {
  name: string
  amount: number
  categoryKey: string
  frequency: RecurringFrequency
  day_of_month: number
  month_of_year: number | null
  starts_on: string
  ends_on: string | null
}

export interface DebtEntryValue {
  debtId: string
  kind: DebtEntryKind
  amount: number // con signo solo en ajustes
  occurred_on: string
  note: string | null
}

export interface GoalContributionValue {
  goalId: string
  amount: number // > 0 aporte, < 0 retiro
  occurred_on: string
  note: string | null
}

export interface PreviewRow<V = TransactionValue> {
  sheet: string
  sourceRow: number // fila como la ve el usuario en Excel (1-based)
  status: RowStatus
  reasons: string[] // errores o motivo de omisión
  selected: boolean // ready → true; duplicate, error, skipped → false
  value?: V
}

export interface ImportStats {
  read: number // filas con datos
  imported: number
  skipped: number // "No importar", desmarcadas y vacías
  duplicates: number // duplicadas no incluidas
  errors: number
}
