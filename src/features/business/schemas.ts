import { z } from "zod"
import { SITE } from "@/config/site"

const SECTOR_IDS = SITE.businessSectors.map((sector) => sector.id) as [
  (typeof SITE.businessSectors)[number]["id"],
  ...(typeof SITE.businessSectors)[number]["id"][]
]

// Mismo formato que el check de business_profiles.tax_id: 5 a 10 dígitos y
// dígito de verificación opcional. No se valida el DV
const TAX_ID_PATTERN = /^\d{5,10}(-\d)?$/

// La lista vive en SITE.businessSectors: agregar un sector no exige migración
export const businessSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "El nombre debe tener al menos 2 caracteres" })
    .max(60, { error: "El nombre debe tener máximo 60 caracteres" }),
  // Vacío = sin NIT
  tax_id: z
    .string()
    .trim()
    .transform((value) => value || null)
    .refine((value) => value === null || TAX_ID_PATTERN.test(value), {
      error:
        "Escribe el NIT con 5 a 10 dígitos y, si quieres, el DV (900123456-7)"
    }),
  sector: z.enum(SECTOR_IDS, { error: "Elige un sector de la lista" })
})

export type BusinessInput = z.infer<typeof businessSchema>
export type BusinessSector = BusinessInput["sector"]
