import { z } from "zod"
import { TRANSACTION_TYPES } from "@/features/categories/constants"
import {
  amountSchema,
  transactionSchema
} from "@/features/transactions/schemas"
import { todayISO } from "@/libs/dates"
import { MAX_CATEGORY_NAME_LENGTH, MAX_ROWS, MIN_DATE } from "./constants"
import { maxDate } from "./normalize"

// Revalidación en el servidor de lo que arma el asistente (SPEC 08). Los
// límites de cada movimiento son los de transactionSchema.

const countSchema = z.int().min(0)

export const importStatsSchema = z.object({
  read: countSchema,
  imported: countSchema,
  skipped: countSchema,
  duplicates: countSchema,
  errors: countSchema
})

export const newCategorySchema = z.object({
  key: z.string().min(1).max(200),
  type: z.enum(TRANSACTION_TYPES),
  name: z
    .string()
    .trim()
    .min(1, { error: "Ingresa un nombre para la categoría" })
    .max(MAX_CATEGORY_NAME_LENGTH, {
      error: `El nombre debe tener máximo ${MAX_CATEGORY_NAME_LENGTH} caracteres`
    })
})

export const importRowSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    amount: amountSchema,
    occurred_on: z.iso
      .date({ error: "Fecha inválida" })
      .refine((value) => value >= MIN_DATE && value <= maxDate(todayISO()), {
        error: "Fecha inválida"
      }),
    category_id: z.uuid().nullable(),
    new_category_key: z.string().min(1).max(200).nullable(),
    description: transactionSchema.shape.description,
    note: z
      .string()
      .trim()
      .max(500, { error: "La nota debe tener máximo 500 caracteres" })
      .nullable()
      .transform((value) => value || null)
  })
  .refine(
    (row) => (row.category_id === null) !== (row.new_category_key === null),
    { error: "Cada movimiento necesita una categoría" }
  )

export const confirmImportSchema = z
  .object({
    filename: z.string().trim().min(1).max(255),
    sheets: z.array(z.string().max(255)).max(500),
    stats: importStatsSchema,
    newCategories: z.array(newCategorySchema).max(MAX_ROWS),
    rows: z
      .array(importRowSchema)
      .min(1, { error: "No hay movimientos para importar" })
      .max(MAX_ROWS, { error: "Máximo 2.000 filas por importación" })
  })
  .superRefine((input, ctx) => {
    const keys = new Set(input.newCategories.map((category) => category.key))

    if (keys.size !== input.newCategories.length) {
      ctx.addIssue({ code: "custom", message: "Categorías nuevas repetidas" })
    }

    const missing = input.rows.some(
      (row) => row.new_category_key !== null && !keys.has(row.new_category_key)
    )
    if (missing) {
      ctx.addIssue({ code: "custom", message: "Falta una categoría nueva" })
    }

    if (input.stats.imported !== input.rows.length) {
      ctx.addIssue({
        code: "custom",
        message: "Los totales no coinciden con los movimientos"
      })
    }
  })

export type ConfirmImportInput = z.input<typeof confirmImportSchema>
export type ImportRowInput = z.input<typeof importRowSchema>
export type NewCategoryInput = z.input<typeof newCategorySchema>

export const duplicateRangeSchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine((range) => range.from <= range.to)
