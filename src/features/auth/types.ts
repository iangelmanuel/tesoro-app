export type OAuthProvider = "google" | "github"

export interface AuthFormState {
  /** Error general (credenciales, email duplicado, etc.) */
  error?: string
  /** Código del error de Supabase (p. ej. `email_not_confirmed`) */
  errorCode?: string
  /** Mensaje de éxito (formularios que no redirigen) */
  success?: string
  /** Errores de validación por campo */
  fieldErrors?: Partial<Record<string, string[]>>
  /** Valores enviados, para no vaciar el formulario si hay error */
  values?: Record<string, string>
}
