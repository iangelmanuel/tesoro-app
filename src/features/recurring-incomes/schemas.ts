import { z } from "zod"
import { amountSchema } from "@/features/transactions/schemas"

export const INCOME_FREQUENCIES = [
  "weekly",
  "biweekly",
  "monthly",
  "yearly",
  "daily",
  "every_n_days",
  "none"
] as const

export type IncomeFrequency = (typeof INCOME_FREQUENCIES)[number]

export { OTHER_INCOME } from "./constants"

/** Días de pago por defecto de un quincenal */
export const BIWEEKLY_DEFAULT_DAYS = [15, 30] as const

// Los campos opcionales del formulario llegan como "" cuando están vacíos
const emptyToNull = (value: unknown) => (value === "" ? null : value)

const DAY_ERROR = "Elige un día entre 1 y 31"

/** Intervalo permitido de "Cada N días" (check de la tabla) */
export const INTERVAL_DAYS_MIN = 2
export const INTERVAL_DAYS_MAX = 90

const WEEKDAY_ERROR = "Elige un día de la semana"
const INTERVAL_ERROR = `Elige un intervalo entre ${INTERVAL_DAYS_MIN} y ${INTERVAL_DAYS_MAX} días`

/** Frecuencias que piden un día del mes */
const MONTH_DAY_FREQUENCIES: readonly IncomeFrequency[] = [
  "monthly",
  "biweekly",
  "yearly"
]

export function usesDayOfMonth(frequency: IncomeFrequency) {
  return MONTH_DAY_FREQUENCIES.includes(frequency)
}

const daySchema = z.preprocess(
  emptyToNull,
  z.coerce
    .number({ error: DAY_ERROR })
    .int({ error: DAY_ERROR })
    .min(1, { error: DAY_ERROR })
    .max(31, { error: DAY_ERROR })
    .nullable()
)

export const recurringIncomeSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "Ingresa un nombre" })
      .max(60, { error: "El nombre debe tener máximo 60 caracteres" }),
    amount: amountSchema,
    category_id: z.uuid({ error: "Elige una categoría" }),
    account_id: z.preprocess(
      emptyToNull,
      z.uuid({ error: "Elige una cuenta válida" }).nullable()
    ),
    frequency: z.enum(INCOME_FREQUENCIES, {
      error: "Elige una frecuencia"
    }),
    day_of_month: daySchema,
    second_day_of_month: daySchema,
    day_of_week: z.preprocess(
      emptyToNull,
      z.coerce
        .number({ error: WEEKDAY_ERROR })
        .int({ error: WEEKDAY_ERROR })
        .min(1, { error: WEEKDAY_ERROR })
        .max(7, { error: WEEKDAY_ERROR })
        .nullable()
    ),
    interval_days: z.preprocess(
      emptyToNull,
      z.coerce
        .number({ error: INTERVAL_ERROR })
        .int({ error: INTERVAL_ERROR })
        .min(INTERVAL_DAYS_MIN, { error: INTERVAL_ERROR })
        .max(INTERVAL_DAYS_MAX, { error: INTERVAL_ERROR })
        .nullable()
    ),
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
    if (data.frequency === "weekly" && data.day_of_week === null) {
      ctx.addIssue({
        code: "custom",
        path: ["day_of_week"],
        message: WEEKDAY_ERROR
      })
    }
    if (data.frequency === "every_n_days" && data.interval_days === null) {
      ctx.addIssue({
        code: "custom",
        path: ["interval_days"],
        message: "Ingresa cada cuántos días llega"
      })
    }
    if (usesDayOfMonth(data.frequency) && data.day_of_month === null) {
      ctx.addIssue({
        code: "custom",
        path: ["day_of_month"],
        message: "Elige el día de pago"
      })
    }
    if (data.frequency === "biweekly") {
      if (data.second_day_of_month === null) {
        ctx.addIssue({
          code: "custom",
          path: ["second_day_of_month"],
          message: "Elige el segundo día de pago"
        })
      } else if (
        data.day_of_month !== null &&
        data.second_day_of_month <= data.day_of_month
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["second_day_of_month"],
          message: "El segundo día debe ser posterior al primero"
        })
      }
    }
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
  // Cada frecuencia guarda solo los días que le aplican (checks de la tabla)
  .transform((data) => ({
    ...data,
    day_of_month: usesDayOfMonth(data.frequency) ? data.day_of_month : null,
    second_day_of_month:
      data.frequency === "biweekly" ? data.second_day_of_month : null,
    month_of_year: data.frequency === "yearly" ? data.month_of_year : null,
    day_of_week: data.frequency === "weekly" ? data.day_of_week : null,
    interval_days: data.frequency === "every_n_days" ? data.interval_days : null
  }))

export type RecurringIncomeInput = z.infer<typeof recurringIncomeSchema>
