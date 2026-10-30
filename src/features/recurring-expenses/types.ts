export interface RecurringExpenseFormState {
  /** true cuando la acción terminó bien */
  ok?: boolean
  /** Error general (gasto fijo no encontrado, error de la BD, etc.) */
  error?: string
  /** Errores de validación por campo */
  fieldErrors?: Partial<Record<string, string[]>>
  /** Valores enviados, para no vaciar el formulario si hay error */
  values?: Record<string, string>
}

export interface RecurringExpenseActionResult {
  error?: string
}
