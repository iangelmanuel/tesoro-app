import type { AuthError } from "@supabase/supabase-js"

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Email o contraseña incorrectos",
  user_already_exists: "Ya existe una cuenta con este email",
  email_exists: "Ya existe una cuenta con este email",
  email_address_invalid: "Ingresa un email válido",
  weak_password: "La contraseña es muy débil. Usa una más segura",
  email_not_confirmed: "Debes confirmar tu email antes de iniciar sesión",
  signup_disabled: "El registro está deshabilitado por ahora",
  over_request_rate_limit:
    "Demasiados intentos. Espera unos minutos y vuelve a intentarlo",
  over_email_send_rate_limit:
    "Demasiados intentos. Espera unos minutos y vuelve a intentarlo"
}

const DEFAULT_ERROR_MESSAGE = "Ocurrió un error inesperado. Intenta de nuevo"

export function translateAuthError(error: AuthError): string {
  return (
    (error.code && AUTH_ERROR_MESSAGES[error.code]) || DEFAULT_ERROR_MESSAGE
  )
}
