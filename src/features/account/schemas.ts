import { z } from "zod"
import { SITE } from "@/config/site"

const CURRENCY_CODES = SITE.currencies.map((currency) => currency.code) as [
  (typeof SITE.currencies)[number]["code"],
  ...(typeof SITE.currencies)[number]["code"][]
]

// Mismas reglas que el nombre del registro (signUpSchema)
export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { error: "El nombre debe tener al menos 2 caracteres" })
    .max(80, { error: "El nombre debe tener máximo 80 caracteres" })
})

// La lista vive en SITE.currencies: agregar una moneda no exige migración
export const currencySchema = z.object({
  currency: z.enum(CURRENCY_CODES, { error: "Elige una moneda de la lista" })
})

export const changeEmailSchema = z.object({
  email: z.email({ error: "Ingresa un email válido" }).trim().toLowerCase()
})

const newPasswordFields = {
  password: z
    .string()
    .min(8, { error: "La contraseña debe tener al menos 8 caracteres" }),
  confirmPassword: z.string()
}

const passwordsMatch = {
  check: (data: { password: string; confirmPassword: string }) =>
    data.password === data.confirmPassword,
  params: {
    error: "Las contraseñas no coinciden",
    path: ["confirmPassword"]
  }
}

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { error: "Ingresa tu contraseña actual" }),
    ...newPasswordFields
  })
  .refine(passwordsMatch.check, passwordsMatch.params)

// Usuarios de solo OAuth: no tienen contraseña actual que pedir
export const createPasswordSchema = z
  .object(newPasswordFields)
  .refine(passwordsMatch.check, passwordsMatch.params)

export type ProfileInput = z.infer<typeof profileSchema>
export type CurrencyInput = z.infer<typeof currencySchema>
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type CreatePasswordInput = z.infer<typeof createPasswordSchema>
