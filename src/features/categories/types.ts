export interface CategoryFormState {
  /** true cuando la acción terminó bien */
  ok?: boolean
  /** Error general (categoría no encontrada, error de la BD, etc.) */
  error?: string
  /** Errores de validación por campo */
  fieldErrors?: Partial<Record<string, string[]>>
  /** Nombre enviado, para no vaciar el formulario si hay error */
  values?: { name: string }
}

export interface CategoryActionResult {
  error?: string
}
