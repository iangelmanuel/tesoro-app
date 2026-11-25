import { z } from "zod"
import {
  BIWEEKLY_DEFAULT_DAYS,
  INCOME_FREQUENCIES,
  INTERVAL_DAYS_MAX,
  INTERVAL_DAYS_MIN,
  type IncomeFrequency,
  usesDayOfMonth
} from "@/features/recurring-incomes/schemas"
import { type MissingField, dateSchema } from "../shared"
import { enumOptions, missingField } from "./entities"
import { accountNameSchema, categoryNameSchema } from "./references"

// Campos, frecuencias y días de las tools de ingresos fijos (SPEC 44) con
// las frecuencias de SPEC 38. Las ocurrencias salen de la frecuencia y sus
// días, igual que en la app. Lógica pura.

/** Mismas etiquetas que el diálogo de la app */
export const FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  yearly: "Anual",
  daily: "Diaria",
  every_n_days: "Cada N días",
  none: "Sin fecha fija"
}

/** Días de la semana de `day_of_week` */
export const WEEKDAY_LABELS: Record<string, string> = {
  "1": "Lunes",
  "2": "Martes",
  "3": "Miércoles",
  "4": "Jueves",
  "5": "Viernes",
  "6": "Sábado",
  "7": "Domingo"
}

/** Frecuencia y días de un ingreso fijo */
export interface Schedule {
  frequency: IncomeFrequency
  day_of_month: number | null
  second_day_of_month: number | null
  day_of_week: number | null
  interval_days: number | null
  month_of_year: number | null
}

/** Los días que pide la frecuencia y no llegaron */
export function scheduleMissing(schedule: Schedule): MissingField[] {
  const missing: MissingField[] = []
  if (schedule.frequency === "weekly" && schedule.day_of_week === null) {
    missing.push(
      missingField(
        "day_of_week",
        "¿Qué día de la semana llega?",
        enumOptions(WEEKDAY_LABELS)
      )
    )
  }
  if (usesDayOfMonth(schedule.frequency) && schedule.day_of_month === null) {
    missing.push(missingField("day_of_month", "¿Qué día del mes llega? (1–31)"))
  }
  if (schedule.frequency === "yearly" && schedule.month_of_year === null) {
    missing.push(
      missingField("month_of_year", "¿En qué mes del año llega? (1–12)")
    )
  }
  if (
    schedule.frequency === "every_n_days" &&
    schedule.interval_days === null
  ) {
    missing.push(
      missingField(
        "interval_days",
        `¿Cada cuántos días llega? (${INTERVAL_DAYS_MIN}–${INTERVAL_DAYS_MAX})`
      )
    )
  }
  return missing
}

/** Quincenal sin días: 15 y 30, como el diálogo de la app */
export function withBiweeklyDefaults(schedule: Schedule): Schedule {
  if (schedule.frequency !== "biweekly") {
    return schedule
  }
  return {
    ...schedule,
    day_of_month: schedule.day_of_month ?? BIWEEKLY_DEFAULT_DAYS[0],
    second_day_of_month:
      schedule.second_day_of_month ?? BIWEEKLY_DEFAULT_DAYS[1]
  }
}

const day = (what: string) => z.number().int().nullable().describe(what)

/** Campos de un ingreso fijo en las tools */
export const fields = {
  name: z.string().describe("Nombre (1–60 caracteres): Salario, Arriendo…"),
  amount: z
    .number()
    .describe(
      "Monto de cada pago, positivo. En quincenal, el de cada quincena."
    ),
  category_id: z
    .uuid({ error: "Elige una categoría" })
    .describe("Categoría de ingreso (de list_categories)."),
  category: categoryNameSchema,
  frequency: z
    .enum(INCOME_FREQUENCIES)
    .describe(
      "weekly, biweekly (quincenal), monthly, yearly, daily, every_n_days o none (sin fecha fija)."
    ),
  day_of_month: day(
    "Monthly, yearly: día de pago (1–31). Biweekly: primer día (por defecto 15)."
  ),
  second_day_of_month: day(
    "Biweekly: segundo día, posterior al primero (por defecto 30)."
  ),
  day_of_week: day("Weekly: día de la semana, 1 = lunes … 7 = domingo."),
  interval_days: day(
    `Every_n_days: cada cuántos días (${INTERVAL_DAYS_MIN}–${INTERVAL_DAYS_MAX}), contados desde starts_on.`
  ),
  month_of_year: day("Yearly: mes de pago (1–12)."),
  starts_on: dateSchema.describe("Desde cuándo aplica, YYYY-MM-DD."),
  ends_on: dateSchema
    .nullable()
    .describe("Hasta cuándo aplica, YYYY-MM-DD. null = sin fin."),
  account_id: z
    .uuid({ error: "Elige una cuenta válida" })
    .nullable()
    .describe("Cuenta por defecto a la que llega. null = ninguna."),
  account: accountNameSchema
}
