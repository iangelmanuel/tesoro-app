import type { IncomeAllocation } from "@/features/recurring-incomes/types"

export interface TransactionFormState {
  /** true cuando la acción terminó bien */
  ok?: boolean
  /** Error general (movimiento no encontrado, error de la BD, etc.) */
  error?: string
  /** Errores de validación por campo */
  fieldErrors?: Partial<Record<string, string[]>>
  /** Valores enviados, para no vaciar el formulario si hay error */
  values?: Record<string, string>
  /** Reparto guardado entre las ocurrencias de un ingreso fijo (SPEC 38) */
  allocations?: IncomeAllocation[]
}

export interface TransactionActionResult {
  error?: string
}
