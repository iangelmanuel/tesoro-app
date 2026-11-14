export interface RecurringIncomeFormState {
  /** true cuando la acción terminó bien */
  ok?: boolean
  /** Error general (ingreso fijo no encontrado, error de la BD, etc.) */
  error?: string
  /** Errores de validación por campo */
  fieldErrors?: Partial<Record<string, string[]>>
  /** Valores enviados, para no vaciar el formulario si hay error */
  values?: Record<string, string>
}

/** Lo que un ingreso cubrió de una ocurrencia de su ingreso fijo (SPEC 38) */
export interface IncomeAllocation {
  due_on: string
  amount: number
}

export interface RecurringIncomeActionResult {
  error?: string
}
