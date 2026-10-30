export interface AccountData {
  user: {
    id: string
    email: string
    /** Email nuevo pendiente de confirmar (double_confirm_changes) */
    newEmail: string | null
  }
  profile: {
    fullName: string
    avatarUrl: string | null
    currency: string
  }
  /** false si el usuario solo entra con OAuth */
  hasPassword: boolean
}

export interface ProfileFormState {
  /** true cuando la acción terminó bien */
  ok?: boolean
  /** Mensaje que se queda visible tras guardar (p. ej. revisar el correo) */
  success?: string
  /** Error general (sin sesión, error de la BD, etc.) */
  error?: string
  /** Errores de validación por campo */
  fieldErrors?: Partial<Record<string, string[]>>
  /** Valores enviados, para no vaciar el formulario si hay error */
  values?: Record<string, string>
}

export interface AccountActionResult {
  error?: string
}
