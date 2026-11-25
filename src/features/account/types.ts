/** Usuario, perfil y si tiene contraseña, para Cuenta */
export interface AccountData {
  user: {
    id: string
    email: string
  }
  profile: {
    fullName: string
    avatarUrl: string | null
    currency: string
    /** Muestra `***` en lugar de saldos y totales */
    hideAmounts: boolean
  }
  /** false si el usuario solo entra con OAuth */
  hasPassword: boolean
}

/** Estado de los formularios de Cuenta */
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

/** Resultado de las acciones de Cuenta sin formulario */
export interface AccountActionResult {
  error?: string
}
