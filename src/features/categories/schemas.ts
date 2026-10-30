import { z } from "zod"
import {
  CATEGORY_COLOR_KEYS,
  CATEGORY_ICON_KEYS,
  TRANSACTION_TYPES
} from "./constants"

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Ingresa un nombre" })
    .max(40, { error: "El nombre debe tener máximo 40 caracteres" }),
  type: z.enum(TRANSACTION_TYPES, { error: "Elige ingreso o gasto" }),
  icon: z.enum(CATEGORY_ICON_KEYS, { error: "Elige un icono" }),
  color: z.enum(CATEGORY_COLOR_KEYS, { error: "Elige un color" })
})

export type CategoryInput = z.infer<typeof categorySchema>
