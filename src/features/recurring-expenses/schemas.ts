import { z } from "zod"
import { amountSchema } from "@/features/transactions/schemas"

export const RECURRING_FREQUENCIES = ["monthly", "yearly"] as const

export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number]

// Los campos opcionales del formulario llegan como "" cuando están vacíos
const emptyToNull = (value: unknown) => (value === "" ? null : value)

export const recurringExpenseSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "Ingresa un nombre" })
      .max(60, { error: "El nombre debe tener máximo 60 caracteres" }),
    amount: amountSchema,
    category_id: z.uuid({ error: "Elige una categoría" }),
    frequency: z.enum(RECURRING_FREQUENCIES, {
      error: "Elige mensual o anual"
    }),
    day_of_month: z.coerce
      .number({ error: "Elige un día entre 1 y 31" })
      .int({ error: "Elige un día entre 1 y 31" })
      .min(1, { error: "Elige un día entre 1 y 31" })
      .max(31, { error: "Elige un día entre 1 y 31" }),
    month_of_year: z.preprocess(
      emptyToNull,
      z.coerce
        .number({ error: "Elige un mes válido" })
        .int({ error: "Elige un mes válido" })
        .min(1, { error: "Elige un mes válido" })
        .max(12, { error: "Elige un mes válido" })
        .nullable()
    ),
    starts_on: z.iso.date({ error: "Elige una fecha de inicio válida" }),
    ends_on: z.preprocess(
      emptyToNull,
      z.iso.date({ error: "Elige una fecha de fin válida" }).nullable()
    )
  })
  .superRefine((data, ctx) => {
    if (data.frequency === "yearly" && data.month_of_year === null) {
      ctx.addIssue({
        code: "custom",
        path: ["month_of_year"],
        message: "Elige el mes de pago"
      })
    }
    // Fechas ISO: la comparación de texto respeta el orden cronológico
    if (data.ends_on !== null && data.ends_on < data.starts_on) {
      ctx.addIssue({
        code: "custom",
        path: ["ends_on"],
        message: "La fecha de fin debe ser igual o posterior al inicio"
      })
    }
  })
  // El mes de pago solo aplica a los anuales (check de la tabla)
  .transform((data) => ({
    ...data,
    month_of_year: data.frequency === "yearly" ? data.month_of_year : null
  }))

export type RecurringExpenseInput = z.infer<typeof recurringExpenseSchema>
