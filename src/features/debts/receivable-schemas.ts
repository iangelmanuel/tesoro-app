import { z } from "zod"
import {
  MAX_AMOUNT,
  paymentAccountSchema
} from "@/features/transactions/schemas"
import { roundCents } from "@/libs/money"
import {
  amountField,
  checkboxField,
  counterpartyField,
  dayField,
  emptyToNull,
  nameField,
  noteField,
  pastDateField,
  paymentDescriptionField,
  positiveAmountField,
  termField
} from "./schema-fields"

// Esquemas de una cuenta por cobrar: de cobro único o mensual (SPEC 28) y su
// cobro (SPEC 39)

/**
 * Tipo de cobro de una cuenta por cobrar (SPEC 28): único o mes a mes. Se
 * elige al crear y no cambia.
 */
const RECEIVABLE_SCHEDULES = ["once", "monthly"] as const

export type ReceivableSchedule = (typeof RECEIVABLE_SCHEDULES)[number]

/** Tipo de cobro: único o mensual */
export const receivableScheduleSchema = z.enum(RECEIVABLE_SCHEDULES, {
  error: "Elige el tipo de cobro"
})

/** Cuenta por cobrar de cobro único, con fecha esperada opcional */
export const receivableSchema = z
  .object({
    name: nameField,
    counterparty: counterpartyField,
    opening_balance: amountField,
    expected_on: z.preprocess(
      emptyToNull,
      z.iso.date({ error: "Elige una fecha válida" }).nullable()
    )
  })
  .transform((data) => ({ ...data, schedule: "once" as const }))

/**
 * Cobro mensual: cuota fija cada mes desde starts_on. Con número de cuotas el
 * saldo inicial es cuota × cuotas; sin él (indefinida) no hay saldo total.
 */
export const monthlyReceivableSchema = z
  .object({
    name: nameField,
    counterparty: counterpartyField,
    installment: positiveAmountField(
      "Ingresa el monto mensual",
      "El monto mensual debe ser mayor a 0"
    ),
    due_day: dayField("Elige un día de pago entre 1 y 31"),
    starts_on: z.iso.date({ error: "Elige la fecha de inicio" }),
    term_months: termField("Ingresa entre 1 y 600 cuotas")
  })
  .superRefine((data, ctx) => {
    if (
      data.term_months !== null &&
      data.installment * data.term_months > MAX_AMOUNT
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["term_months"],
        message: "El total de las cuotas es demasiado grande"
      })
    }
  })
  .transform((data) => ({
    ...data,
    schedule: "monthly" as const,
    expected_on: null,
    opening_balance:
      data.term_months === null
        ? 0
        : roundCents(data.installment * data.term_months)
  }))

/**
 * Cobro de una cuenta por cobrar (SPEC 39). El modo depende del tipo de
 * cobro: Abono o Pago completo en una de cobro único; Una cuota o Varios
 * meses en una mensual.
 */
const RECEIVABLE_COLLECT_MODES = [
  "partial", // Abono (una vez)
  "full", // Pago completo (una vez)
  "single", // Una cuota (mes a mes)
  "allocate" // Varios meses (mes a mes)
] as const

export type ReceivableCollectMode = (typeof RECEIVABLE_COLLECT_MODES)[number]

/** Modos válidos para cada tipo de cobro */
export const COLLECT_MODES_BY_SCHEDULE: Record<
  ReceivableSchedule,
  readonly ReceivableCollectMode[]
> = {
  once: ["partial", "full"],
  monthly: ["single", "allocate"]
}

// Cuota (primer día del mes) que cobra "Una cuota"
const periodField = z.iso
  .date({ error: "Elige la cuota que se cobra" })
  .refine((value) => value.endsWith("-01"), {
    error: "Elige la cuota que se cobra"
  })

// account_id es la cuenta del ingreso: solo aplica con create_transaction
const collectBase = {
  occurred_on: pastDateField,
  note: noteField,
  description: paymentDescriptionField,
  create_transaction: checkboxField,
  account_id: paymentAccountSchema.shape.account_id
}

/** En "Pago completo" el monto es el saldo pendiente: lo pone el servidor */
export const receivableCollectSchema = z.discriminatedUnion(
  "mode",
  [
    z.object({
      mode: z.literal("partial"),
      amount: amountField,
      ...collectBase
    }),
    z.object({ mode: z.literal("full"), ...collectBase }),
    z.object({
      mode: z.literal("single"),
      amount: amountField,
      period_on: periodField,
      ...collectBase
    }),
    z.object({
      mode: z.literal("allocate"),
      amount: amountField,
      ...collectBase
    })
  ],
  { error: "Elige cómo se cobra" }
)

export type ReceivableCollectInput = z.infer<typeof receivableCollectSchema>
