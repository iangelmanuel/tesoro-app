export interface GoalFormState {
  /** true cuando la acción terminó bien */
  ok?: boolean
  /** Error general (meta no encontrada, error de la BD, etc.) */
  error?: string
  /** Errores de validación por campo */
  fieldErrors?: Partial<Record<string, string[]>>
  /** Valores enviados, para no vaciar el formulario si hay error */
  values?: Record<string, string>
}

export type ContributionFormState = GoalFormState

export interface GoalActionResult {
  error?: string
}
