import type { Database } from "@/types/database"

export type TransactionType = Database["public"]["Enums"]["transaction_type"]

export type ImportField =
  | "date"
  | "amount"
  | "type"
  | "income_amount"
  | "expense_amount"
  | "category"
  | "description"
  | "note"

export type TypeMode = "column" | "sign" | "split" // valores, signo, dos columnas
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
}

export type RowStatus = "ready" | "duplicate" | "error" | "skipped"

export interface PreviewRow {
  sheet: string
  sourceRow: number // fila como la ve el usuario en Excel (1-based)
  status: RowStatus
  reasons: string[] // errores o motivo de omisión
  selected: boolean // ready → true; duplicate, error, skipped → false
  value?: {
    type: TransactionType
    amount: number
    occurred_on: string
    categoryKey: string
    description: string
    note: string | null
  }
}

export interface ImportStats {
  read: number // filas con datos
  imported: number
  skipped: number // "No importar", desmarcadas y vacías
  duplicates: number // duplicadas no incluidas
  errors: number
}
