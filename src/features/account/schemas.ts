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

export type ProfileInput = z.infer<typeof profileSchema>
export type CurrencyInput = z.infer<typeof currencySchema>
