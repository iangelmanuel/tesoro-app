export type OAuthProvider = "google" | "github"

export interface AuthFormState {
  /** Error general (credenciales, email duplicado, etc.) */
  error?: string
  /** Errores de validación por campo */
  fieldErrors?: Partial<Record<string, string[]>>
  /** Valores enviados, para no vaciar el formulario si hay error */
  values?: Record<string, string>
}
