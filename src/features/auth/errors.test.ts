import type { AuthError } from "@supabase/supabase-js"
import { describe, expect, it } from "vitest"
import { translateAuthError } from "./errors"

const error = (code: string | undefined) => ({ code }) as AuthError

describe("translateAuthError", () => {
  it("traduce los códigos conocidos", () => {
    expect(translateAuthError(error("invalid_credentials"))).toBe(
      "Email o contraseña incorrectos"
    )
    expect(translateAuthError(error("email_exists"))).toBe(
      "Ya existe una cuenta con este email"
    )
    expect(translateAuthError(error("over_email_send_rate_limit"))).toBe(
      "Demasiados intentos. Espera unos minutos y vuelve a intentarlo"
    )
  })

  it("sin código o desconocido, el genérico", () => {
    const generic = "Ocurrió un error inesperado. Intenta de nuevo"
    expect(translateAuthError(error(undefined))).toBe(generic)
    expect(translateAuthError(error("algo_nuevo"))).toBe(generic)
  })
})
