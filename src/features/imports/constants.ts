import { SITE } from "@/config/site"
import type {
  DebtEntryTarget,
  GoalEntryTarget,
  ImportField,
  RecurringFrequency,
  TransactionType
} from "./types"

/** Tamaño máximo del archivo, antes de leerlo */
export const MAX_FILE_BYTES = 5 * 1024 * 1024

/** Extensiones aceptadas, en minúsculas y sin punto */
export const FILE_EXTENSIONS = ["xlsx", "csv"] as const

/** Filas con datos por importación, sumando todas las hojas */
export const MAX_ROWS = 2000

/** Filas que muestra la vista de cada tabla en el paso 2 */
export const SAMPLE_ROWS = 5

/** Filas por página en la vista previa */
export const PREVIEW_PAGE_SIZE = 100

/** Filas vacías seguidas que cierran una tabla */
export const TABLE_END_EMPTY_ROWS = 3

/** Celdas de texto contiguas mínimas en una fila de encabezados */
export const MIN_HEADER_CELLS = 3

/** Rango de números que se leen como serie de fecha de Excel (sistema 1900) */
export const EXCEL_SERIAL_MIN = 20_000
export const EXCEL_SERIAL_MAX = 80_000

/** Fecha mínima aceptada; la máxima es hoy + 1 año */
export const MIN_DATE = "2000-01-01"

/** Límites de transactions (SPEC 02) y categories */
export const MAX_DESCRIPTION_LENGTH = 120
export const MAX_NOTE_LENGTH = 500
export const MAX_CATEGORY_NAME_LENGTH = 40

/** Nombre de accounts (SPEC 08c) */
export const MAX_ACCOUNT_NAME_LENGTH = 40

/** Nombre de recurring_expenses (SPEC 04) */
export const MAX_RECURRING_NAME_LENGTH = 60
/** Nota de goal_contributions y debt_entries (SPEC 05 y 06) */
export const MAX_ENTRY_NOTE_LENGTH = 120

/** Valor de categoría de origen cuando la celda está vacía */
export const EMPTY_CATEGORY_LABEL = "Sin categoría"

/** Categoría del sistema cuando no se mapea la columna de categoría */
export const DEFAULT_CATEGORY_NAMES: Record<TransactionType, string> = {
  income: "Otros ingresos",
  expense: "Otros gastos"
}

/** Encabezados normalizados que sugieren cada campo de movimientos */
export const HEADER_SYNONYMS: Partial<Record<ImportField, readonly string[]>> =
  {
    date: ["fecha", "date", "dia"],
    amount: ["monto", "valor", "importe", "amount"],
    type: ["tipo", "salida entrada", "entrada salida", "movimiento"],
    income_amount: ["ingreso", "entrada", "abono", "credito"],
    expense_amount: ["gasto", "salida", "cargo", "debito"],
    category: ["categoria", "category", "rubro"],
    description: ["descripcion", "concepto", "detalle", "notas", "description"],
    note: ["nota", "observacion", "comentario"],
    account: ["metodo", "medio de pago", "forma de pago", "cuenta"]
  }

/** Valores normalizados de la columna de tipo que sugieren ingreso o gasto */
export const TYPE_VALUE_SYNONYMS: Record<TransactionType, readonly string[]> = {
  income: ["entrada", "ingreso", "income"],
  expense: ["salida", "gasto", "egreso", "expense"]
}

/** Valores normalizados de la columna de frecuencia (gastos fijos) */
export const FREQUENCY_VALUE_SYNONYMS: Record<
  RecurringFrequency,
  readonly string[]
> = {
  monthly: ["mensual", "mes", "monthly"],
  yearly: ["anual", "ano", "yearly"]
}

/** Valores normalizados de la columna de tipo en deudas */
export const DEBT_ENTRY_VALUE_SYNONYMS: Partial<
  Record<DebtEntryTarget, readonly string[]>
> = {
  payment: ["pago", "abono", "payment"],
  charge: ["compra", "cargo", "interes", "intereses", "cuota de manejo"]
}

/** Valores normalizados de la columna de tipo en metas */
export const GOAL_ENTRY_VALUE_SYNONYMS: Partial<
  Record<GoalEntryTarget, readonly string[]>
> = {
  contribution: ["aporte", "ahorro", "deposito"],
  withdrawal: ["retiro", "saca"]
}

/** Nombres de los meses normalizados, en orden (índice + 1 = mes) */
export const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre"
] as const

export const FIELD_LABELS: Record<ImportField, string> = {
  date: "Fecha",
  amount: "Monto",
  type: "Tipo",
  income_amount: "Ingreso",
  expense_amount: "Gasto",
  category: "Categoría",
  description: "Descripción",
  note: "Nota",
  account: "Cuenta",
  name: "Nombre",
  frequency: "Frecuencia",
  day_of_month: "Día",
  month_of_year: "Mes",
  starts_on: "Inicio",
  ends_on: "Fin",
  entry_type: "Tipo",
  debt: "Deuda",
  goal: "Meta"
}

export const IMPORT_PATH = `${SITE.routes.dashboardPersonal}/import` as const
