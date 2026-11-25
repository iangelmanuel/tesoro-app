import { z } from "zod"
import { MAX_AMOUNT } from "@/features/transactions/schemas"
import { receivableSchema } from "./receivable-schemas"
import {
  amountField,
  balanceField,
  counterpartyField,
  dayField,
  emptyToNull,
  nameField,
  optionalAmountField,
  toAmount
} from "./schema-fields"

// Esquemas de una deuda: tarjeta y préstamo, con su tasa y su cuenta por
// defecto. La cuenta por cobrar está en receivable-schemas.ts.

export const DEBT_KINDS = ["credit_card", "loan", "receivable"] as const
export const RATE_TYPES = ["ea", "mv"] as const

export type DebtKind = (typeof DEBT_KINDS)[number]
export type RateType = (typeof RATE_TYPES)[number]

/** Tope de la tasa por tipo (checks de la tabla) */
export const MAX_RATE: Record<RateType, number> = { ea: 200, mv: 10 }

/** Tasa escrita con coma decimal ("28,5"), hasta 3 decimales */
export function parseRate(value: string) {
  const normalized = value.replace(/[%\s]/g, "").replace(",", ".")

  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) {
    return Number.NaN
  }
  return Number(normalized)
}

const rateField = z.preprocess(
  (value) => {
    const empty = emptyToNull(value)
    return typeof empty === "string" ? parseRate(empty) : empty
  },
  z
    .number({ error: "Ingresa una tasa válida" })
    .refine((value) => !Number.isNaN(value), {
      error: "Ingresa una tasa válida"
    })
    .nullable()
)

const rateTypeField = z.preprocess(
  emptyToNull,
  z.enum(RATE_TYPES, { error: "Elige E.A. o M.V." }).nullable()
)

/**
 * Cuenta por defecto de la deuda (SPEC 41): prellena la cuenta al pagar. Vacía
 * = ninguna. Va aparte de los esquemas por tipo: aplica a todos
 */
export const habitualAccountSchema = z.preprocess(
  emptyToNull,
  z.uuid({ error: "Elige una cuenta válida" }).nullable()
)

// Tasa y tipo van juntos, y la tasa respeta el tope de su tipo
function checkRate(
  data: { interest_rate: number | null; rate_type: RateType | null },
  ctx: z.RefinementCtx,
  required: boolean
) {
  if (data.interest_rate === null) {
    if (required) {
      ctx.addIssue({
        code: "custom",
        path: ["interest_rate"],
        message: "Ingresa la tasa de interés (0 si no tiene)"
      })
    }
    return
  }
  if (data.rate_type === null) {
    ctx.addIssue({
      code: "custom",
      path: ["rate_type"],
      message: "Elige E.A. o M.V."
    })
    return
  }
  if (data.interest_rate > MAX_RATE[data.rate_type]) {
    ctx.addIssue({
      code: "custom",
      path: ["interest_rate"],
      message: `La tasa ${data.rate_type === "ea" ? "E.A." : "M.V."} debe ser máximo ${MAX_RATE[data.rate_type]} %`
    })
  }
}

// Sin tasa no se guarda el tipo (check de la tabla)
function withRateType<
  T extends { interest_rate: number | null; rate_type: RateType | null }
>(data: T): T {
  return {
    ...data,
    rate_type: data.interest_rate === null ? null : data.rate_type
  }
}

// Cuota de manejo: monto y día de cobro van juntos o ninguno
function checkFee(
  data: { fee_amount: number | null; fee_day: number | null },
  ctx: z.RefinementCtx
) {
  if (data.fee_amount !== null && data.fee_day === null) {
    ctx.addIssue({
      code: "custom",
      path: ["fee_day"],
      message: "Elige el día de cobro de la cuota"
    })
  }
  if (data.fee_day !== null && data.fee_amount === null) {
    ctx.addIssue({
      code: "custom",
      path: ["fee_amount"],
      message: "Ingresa el monto de la cuota"
    })
  }
}

/** Tarjeta de crédito: cupo, día de pago, tasa opcional y cuota de manejo */
export const creditCardSchema = z
  .object({
    name: nameField,
    counterparty: counterpartyField,
    opening_balance: balanceField,
    credit_limit: z.preprocess(
      toAmount,
      z
        .number({ error: "Ingresa el cupo" })
        .refine((value) => !Number.isNaN(value), {
          error: "Ingresa el cupo"
        })
        .refine((value) => value > 0, { error: "El cupo debe ser mayor a 0" })
        .refine((value) => value <= MAX_AMOUNT, {
          error: "El monto es demasiado grande"
        })
    ),
    due_day: dayField("Elige un día de pago entre 1 y 31"),
    interest_rate: rateField,
    rate_type: rateTypeField,
    min_payment: optionalAmountField,
    closing_day: z.preprocess(
      emptyToNull,
      dayField("Elige un día de corte entre 1 y 31").nullable()
    ),
    fee_amount: optionalAmountField,
    fee_day: z.preprocess(
      emptyToNull,
      dayField("Elige un día de cobro entre 1 y 31").nullable()
    )
  })
  .superRefine((data, ctx) => {
    checkRate(data, ctx, false)
    checkFee(data, ctx)
  })
  .transform(withRateType)

/** Préstamo: cuota, día de pago y tasa obligatoria (0 si no tiene) */
export const loanSchema = z
  .object({
    name: nameField,
    counterparty: counterpartyField,
    opening_balance: amountField,
    installment: z.preprocess(
      toAmount,
      z
        .number({ error: "Ingresa la cuota" })
        .refine((value) => !Number.isNaN(value), {
          error: "Ingresa la cuota"
        })
        .refine((value) => value > 0, { error: "La cuota debe ser mayor a 0" })
        .refine((value) => value <= MAX_AMOUNT, {
          error: "El monto es demasiado grande"
        })
    ),
    interest_rate: rateField,
    rate_type: rateTypeField,
    due_day: dayField("Elige un día de pago entre 1 y 31"),
    original_amount: optionalAmountField,
    term_months: z.preprocess(
      emptyToNull,
      z.coerce
        .number({ error: "Ingresa un plazo entre 1 y 600 meses" })
        .int({ error: "Ingresa un plazo entre 1 y 600 meses" })
        .min(1, { error: "Ingresa un plazo entre 1 y 600 meses" })
        .max(600, { error: "Ingresa un plazo entre 1 y 600 meses" })
        .nullable()
    )
  })
  .superRefine((data, ctx) => checkRate(data, ctx, true))
  .transform(withRateType)

export const DEBT_SCHEMAS = {
  credit_card: creditCardSchema,
  loan: loanSchema,
  receivable: receivableSchema
} as const

export type CreditCardInput = z.infer<typeof creditCardSchema>
export type LoanInput = z.infer<typeof loanSchema>
