import { z } from "zod"
import {
  CATEGORY_COLOR_KEYS,
  CATEGORY_ICON_KEYS
} from "@/features/categories/constants"
import { amountSchema } from "@/features/transactions/schemas"
import { todayISO } from "@/libs/dates"

export const CONTRIBUTION_KINDS = ["deposit", "withdrawal"] as const

export type ContributionKind = (typeof CONTRIBUTION_KINDS)[number]

// Los campos opcionales del formulario llegan como "" cuando están vacíos
const emptyToNull = (value: unknown) => (value === "" ? null : value)

/**
 * Meta nueva o editada. La fecha objetivo debe ser posterior a hoy al crear
 * o al cambiarla; al editar otros campos, una fecha ya pasada se conserva
 * (`currentTargetDate`).
 */
export function goalSchema(currentTargetDate?: string | null) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, { error: "Ingresa un nombre" })
        .max(60, { error: "El nombre debe tener máximo 60 caracteres" }),
      target_amount: amountSchema,
      target_date: z.preprocess(
        emptyToNull,
        z.iso.date({ error: "Elige una fecha objetivo válida" }).nullable()
      ),
      icon: z.enum(CATEGORY_ICON_KEYS, { error: "Elige un icono" }),
      color: z.enum(CATEGORY_COLOR_KEYS, { error: "Elige un color" })
    })
    .superRefine((data, ctx) => {
      // Fechas ISO: la comparación de texto respeta el orden cronológico
      if (
        data.target_date !== null &&
        data.target_date !== currentTargetDate &&
        data.target_date <= todayISO()
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["target_date"],
          message: "La fecha objetivo debe ser posterior a hoy"
        })
      }
    })
}

export type GoalInput = z.infer<ReturnType<typeof goalSchema>>

// Aporte o retiro. El monto se escribe positivo y `kind` le pone el signo.
export const contributionSchema = z
  .object({
    kind: z.enum(CONTRIBUTION_KINDS, { error: "Elige aporte o retiro" }),
    amount: amountSchema,
    occurred_on: z.iso
      .date({ error: "Elige una fecha válida" })
      .refine((value) => value <= todayISO(), {
        error: "La fecha no puede ser futura"
      }),
    note: z
      .string()
      .trim()
      .max(120, { error: "La nota debe tener máximo 120 caracteres" })
      .transform((value) => value || null)
  })
  .transform(({ kind, amount, ...data }) => ({
    ...data,
    amount: kind === "withdrawal" ? -amount : amount
  }))

export type ContributionInput = z.infer<typeof contributionSchema>
