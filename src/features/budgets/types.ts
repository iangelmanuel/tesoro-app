export interface BudgetFormState {
  /** true cuando la acción terminó bien */
  ok?: boolean
  /** Error general (presupuesto no encontrado, error de la BD, etc.) */
  error?: string
  /** Errores de validación por campo */
  fieldErrors?: Partial<Record<string, string[]>>
  /** Valores enviados, para no vaciar el formulario si hay error */
  values?: Record<string, string>
}

export interface BudgetActionResult {
  error?: string
}

export interface CopyBudgetsResult {
  error?: string
  /** Presupuestos creados; los que ya existían no cuentan */
  copied?: number
}
