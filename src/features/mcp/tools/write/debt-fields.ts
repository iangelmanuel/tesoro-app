import { z } from "zod"
import { type DebtKind, RATE_TYPES } from "@/features/debts/debt-schemas"
import type { ReceivableSchedule } from "@/features/debts/receivable-schemas"
import { debtFieldsFor } from "@/features/debts/service"
import { type MissingField, dateSchema } from "../shared"
import { definedKeys, missingField } from "./entities"
import { accountNameSchema } from "./references"

// Campos y preguntas de las tools de deudas y Me deben (SPEC 44). Cada tipo
// valida con su esquema de la UI; un campo que no aplica al tipo vuelve como
// needs_input en vez de ignorarse en silencio. Lógica pura.

/** Tipo de deuda en las preguntas */
export const KIND_LABELS: Record<DebtKind, string> = {
  credit_card: "una tarjeta de crédito",
  loan: "un préstamo",
  receivable: "una cuenta por cobrar"
}

/** Tipo de cobro de Me deben */
export const SCHEDULE_LABELS: Record<ReceivableSchedule, string> = {
  once: "Cobro único",
  monthly: "Mes a mes"
}

/** Nombre de cada campo en las preguntas */
export const FIELD_LABELS: Record<string, string> = {
  name: "el nombre",
  counterparty: "la entidad o persona",
  opening_balance: "el saldo",
  credit_limit: "el cupo",
  due_day: "el día de pago",
  closing_day: "el día de corte",
  interest_rate: "la tasa de interés",
  rate_type: "el tipo de tasa",
  min_payment: "el pago mínimo",
  fee_amount: "la cuota de manejo",
  fee_day: "el día de cobro de la cuota de manejo",
  installment: "la cuota",
  original_amount: "el monto original",
  term_months: "el plazo",
  expected_on: "la fecha esperada de pago",
  starts_on: "la fecha de inicio"
}

/** Preguntas de los campos obligatorios al crear, por tipo */
export const REQUIRED: Record<string, Record<string, string>> = {
  credit_card: {
    name: "¿Cómo se llama la tarjeta?",
    opening_balance: "¿Cuánto debes hoy en la tarjeta? (0 si nada)",
    credit_limit: "¿Cuál es el cupo de la tarjeta?",
    closing_day: "¿Qué día del mes es el corte de la tarjeta?",
    due_day: "¿Qué día del mes se paga la tarjeta?"
  },
  loan: {
    name: "¿Cómo se llama el préstamo?",
    opening_balance: "¿Cuánto debes hoy del préstamo?",
    installment: "¿De cuánto es la cuota mensual?",
    interest_rate: "¿Cuál es la tasa de interés? (0 si no tiene)",
    due_day: "¿Qué día del mes se paga la cuota?"
  },
  receivable_once: {
    name: "¿Cómo llamamos esta cuenta por cobrar?",
    opening_balance: "¿Cuánto te deben?"
  },
  receivable_monthly: {
    name: "¿Cómo llamamos esta cuenta por cobrar?",
    installment: "¿Cuánto te pagan cada mes?",
    due_day: "¿Qué día del mes te pagan?",
    starts_on: "¿Desde qué fecha empieza el cobro mensual? (YYYY-MM-DD)"
  }
}

/** Clave de REQUIRED según el tipo y el cobro */
export function requiredKey(
  kind: DebtKind,
  schedule: ReceivableSchedule | null
) {
  return kind === "receivable" ? `receivable_${schedule ?? "once"}` : kind
}

const amount = (what: string) => z.number().describe(what)
const day = (what: string) => z.number().int().describe(what)

/** Campos de una tarjeta o un préstamo */
export const debtFields = {
  name: z.string().describe("Nombre (1–60 caracteres)."),
  counterparty: z
    .string()
    .describe("Banco, entidad o persona (hasta 60), opcional."),
  opening_balance: amount("Saldo que se debe hoy."),
  credit_limit: amount("Tarjeta: cupo total."),
  closing_day: day("Tarjeta: día de corte (1–31)."),
  due_day: day("Día de pago (1–31)."),
  interest_rate: z
    .number()
    .nullable()
    .describe(
      "Tasa de interés en %. Préstamo: obligatoria (0 si no tiene). Tarjeta: opcional."
    ),
  rate_type: z
    .enum(RATE_TYPES)
    .nullable()
    .describe("ea (efectiva anual) o mv (mes vencido). Va con la tasa."),
  min_payment: amount("Tarjeta: pago mínimo, opcional.").nullable(),
  fee_amount: amount(
    "Tarjeta: cuota de manejo mensual, opcional. Va con fee_day."
  ).nullable(),
  fee_day: day("Tarjeta: día de cobro de la cuota de manejo.").nullable(),
  installment: amount("Préstamo: cuota mensual."),
  original_amount: amount("Préstamo: monto prestado, opcional.").nullable(),
  term_months: z
    .number()
    .int()
    .nullable()
    .describe("Préstamo: plazo en meses (1–600), opcional.")
}

/** Campos de una cuenta por cobrar */
export const receivableFields = {
  name: debtFields.name,
  counterparty: z.string().describe("Quién te debe (hasta 60), opcional."),
  opening_balance: amount("Cobro único: cuánto te deben."),
  expected_on: dateSchema
    .nullable()
    .describe("Cobro único: fecha esperada de pago YYYY-MM-DD, opcional."),
  installment: amount("Mes a mes: monto de cada mes."),
  due_day: day("Mes a mes: día de pago (1–31)."),
  starts_on: dateSchema.describe("Mes a mes: fecha de inicio YYYY-MM-DD."),
  term_months: z
    .number()
    .int()
    .nullable()
    .describe("Mes a mes: número de cuotas (1–600). null = indefinida.")
}

/** Cuenta por defecto de los pagos */
export const accountFields = {
  account_id: z
    .uuid({ error: "Elige una cuenta válida" })
    .nullable()
    .optional()
    .describe(
      "Cuenta por defecto de los pagos (prellena la cuenta al pagar). null = ninguna."
    ),
  account: accountNameSchema.optional()
}

/** Campos enviados que no aplican al tipo: se pregunta si se quitan */
export function notApplicable(
  values: Record<string, unknown>,
  kind: DebtKind,
  schedule: ReceivableSchedule | null
): MissingField[] {
  const applies = new Set(debtFieldsFor(kind, schedule))
  const what =
    kind === "receivable" && schedule
      ? `${KIND_LABELS.receivable} (${SCHEDULE_LABELS[schedule].toLowerCase()})`
      : KIND_LABELS[kind]
  return definedKeys(values)
    .filter((key) => key in FIELD_LABELS && !applies.has(key))
    .map((key) =>
      missingField(
        key,
        `${capitalize(FIELD_LABELS[key])} no aplica a ${what}. ¿Lo quitamos o es otro tipo?`
      )
    )
}

/** Los valores de `args` para las claves de `shape` */
export function valuesOf(args: Record<string, unknown>, shape: z.ZodRawShape) {
  return Object.fromEntries(Object.keys(shape).map((key) => [key, args[key]]))
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Solo los campos del tipo, con los vacíos opcionales en null */
export function pickFields(
  values: Record<string, unknown>,
  kind: DebtKind,
  schedule: ReceivableSchedule | null
) {
  return Object.fromEntries(
    debtFieldsFor(kind, schedule).map((key) => [
      key,
      values[key] === undefined
        ? key === "counterparty"
          ? ""
          : null
        : values[key]
    ])
  )
}

/** Preguntas de los campos obligatorios del tipo que no llegaron o vacíos */
export function missingRequired(
  values: Record<string, unknown>,
  kind: DebtKind,
  schedule: ReceivableSchedule | null
): MissingField[] {
  return Object.entries(REQUIRED[requiredKey(kind, schedule)])
    .filter(([key]) => {
      const value = values[key]
      return (
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "")
      )
    })
    .map(([key, question]) => missingField(key, question))
}
