import { z } from "zod"
import { TRANSACTION_TYPES } from "@/features/categories/constants"
import { RECURRING_FREQUENCIES } from "@/features/recurring-expenses/schemas"
import {
  MAX_AMOUNT,
  amountSchema,
  transactionSchema
} from "@/features/transactions/schemas"
import { todayISO } from "@/libs/dates"
import {
  MAX_ACCOUNT_NAME_LENGTH,
  MAX_CATEGORY_NAME_LENGTH,
  MAX_ENTRY_NOTE_LENGTH,
  MAX_RECURRING_NAME_LENGTH,
  MAX_ROWS,
  MIN_DATE
} from "./constants"
import { maxDate } from "./normalize"

// Revalidación en el servidor de lo que arma el asistente (SPEC 08 y 08b).
// Los límites de cada fila son los de los schemas de su tabla (SPEC 02, 04,
// 05 y 06).

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

// Cuenta nueva de la columna Método (SPEC 08c)
export const newAccountSchema = z.object({
  key: z.string().min(1).max(200),
  name: z
    .string()
    .trim()
    .min(1, { error: "Ingresa un nombre para la cuenta" })
    .max(MAX_ACCOUNT_NAME_LENGTH, {
      error: `El nombre debe tener máximo ${MAX_ACCOUNT_NAME_LENGTH} caracteres`
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
      .transform((value) => value || null),
    // Cuenta opcional: existente, nueva o ninguna
    account_id: z.uuid().nullable().default(null),
    new_account_key: z.string().min(1).max(200).nullable().default(null)
  })
  .refine(
    (row) => (row.category_id === null) !== (row.new_category_key === null),
    { error: "Cada movimiento necesita una categoría" }
  )
  .refine((row) => row.account_id === null || row.new_account_key === null, {
    error: "Cada movimiento tiene una sola cuenta"
  })

export const confirmImportSchema = z
  .object({
    filename: z.string().trim().min(1).max(255),
    sheets: z.array(z.string().max(255)).max(500),
    stats: importStatsSchema,
    newCategories: z.array(newCategorySchema).max(MAX_ROWS),
    newAccounts: z.array(newAccountSchema).max(MAX_ROWS).default([]),
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

    const accountKeys = new Set(input.newAccounts.map((account) => account.key))

    if (accountKeys.size !== input.newAccounts.length) {
      ctx.addIssue({ code: "custom", message: "Cuentas nuevas repetidas" })
    }
    if (
      input.rows.some(
        (row) =>
          row.new_account_key !== null && !accountKeys.has(row.new_account_key)
      )
    ) {
      ctx.addIssue({ code: "custom", message: "Falta una cuenta nueva" })
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

// --- SPEC 08b ---

const DEBT_ENTRY_KINDS = ["payment", "adjustment"] as const

const importDateSchema = z.iso
  .date({ error: "Fecha inválida" })
  .refine((value) => value >= MIN_DATE && value <= maxDate(todayISO()), {
    error: "Fecha inválida"
  })

const pastDateSchema = z.iso
  .date({ error: "Fecha inválida" })
  .refine((value) => value >= MIN_DATE && value <= todayISO(), {
    error: "La fecha no puede ser futura"
  })

/** Monto con signo distinto de 0, con valor absoluto ≤ MAX_AMOUNT */
const signedAmountSchema = z
  .number({ error: "Monto inválido" })
  .refine((value) => Number.isFinite(value) && value !== 0, {
    error: "Monto inválido"
  })
  .refine((value) => Math.abs(value) <= MAX_AMOUNT, {
    error: "El monto es demasiado grande"
  })

const entryNoteSchema = z
  .string()
  .trim()
  .max(MAX_ENTRY_NOTE_LENGTH, {
    error: `La nota debe tener máximo ${MAX_ENTRY_NOTE_LENGTH} caracteres`
  })
  .nullable()
  .transform((value) => value || null)

const importFileShape = {
  filename: z.string().trim().min(1).max(255),
  sheets: z.array(z.string().max(255)).max(500),
  stats: importStatsSchema
}

function checkStats(
  input: { stats: { imported: number }; rows: unknown[] },
  ctx: z.RefinementCtx
) {
  if (input.stats.imported !== input.rows.length) {
    ctx.addIssue({
      code: "custom",
      message: "Los totales no coinciden con las filas"
    })
  }
}

function rowsSchema<T extends z.ZodType>(row: T) {
  return z
    .array(row)
    .min(1, { error: "No hay filas para importar" })
    .max(MAX_ROWS, { error: "Máximo 2.000 filas por importación" })
}

export const recurringImportRowSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "Falta el nombre" })
      .max(MAX_RECURRING_NAME_LENGTH, {
        error: `El nombre debe tener máximo ${MAX_RECURRING_NAME_LENGTH} caracteres`
      }),
    amount: amountSchema,
    category_id: z.uuid().nullable(),
    new_category_key: z.string().min(1).max(200).nullable(),
    frequency: z.enum(RECURRING_FREQUENCIES),
    day_of_month: z.int().min(1).max(31),
    month_of_year: z.int().min(1).max(12).nullable(),
    starts_on: importDateSchema,
    ends_on: importDateSchema.nullable()
  })
  .refine(
    (row) => (row.category_id === null) !== (row.new_category_key === null),
    { error: "Cada gasto fijo necesita una categoría" }
  )
  .refine(
    (row) => (row.frequency === "yearly") === (row.month_of_year !== null),
    { error: "Falta el mes" }
  )
  .refine((row) => row.ends_on === null || row.ends_on >= row.starts_on, {
    error: "El fin es antes del inicio"
  })

export const confirmRecurringImportSchema = z
  .object({
    ...importFileShape,
    newCategories: z
      .array(newCategorySchema.omit({ type: true }))
      .max(MAX_ROWS),
    rows: rowsSchema(recurringImportRowSchema)
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

    checkStats(input, ctx)
  })

export const debtEntryImportRowSchema = z
  .object({
    debt_id: z.uuid(),
    kind: z.enum(DEBT_ENTRY_KINDS),
    amount: signedAmountSchema,
    occurred_on: pastDateSchema,
    note: entryNoteSchema
  })
  .refine((row) => row.kind === "adjustment" || row.amount > 0, {
    error: "Monto inválido"
  })

export const confirmDebtEntriesImportSchema = z
  .object({
    ...importFileShape,
    createTransactions: z.boolean(),
    rows: rowsSchema(debtEntryImportRowSchema)
  })
  .superRefine(checkStats)

export const goalContributionImportRowSchema = z.object({
  goal_id: z.uuid(),
  amount: signedAmountSchema,
  occurred_on: pastDateSchema,
  note: entryNoteSchema
})

export const confirmGoalContributionsImportSchema = z
  .object({
    ...importFileShape,
    rows: rowsSchema(goalContributionImportRowSchema)
  })
  .superRefine(checkStats)

export type ConfirmRecurringImportInput = z.input<
  typeof confirmRecurringImportSchema
>
export type ConfirmDebtEntriesImportInput = z.input<
  typeof confirmDebtEntriesImportSchema
>
export type ConfirmGoalContributionsImportInput = z.input<
  typeof confirmGoalContributionsImportSchema
>

/** Ids de deudas o metas para buscar duplicados (máximo 200 distintas) */
export const linkDuplicatesSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  ids: z.array(z.uuid()).min(1).max(200)
})
