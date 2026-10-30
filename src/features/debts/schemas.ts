import { z } from "zod"
import {
  MAX_AMOUNT,
  amountSchema,
  parseAmount
} from "@/features/transactions/schemas"
import { todayISO } from "@/libs/dates"

export const DEBT_KINDS = ["credit_card", "loan", "receivable"] as const
export const RATE_TYPES = ["ea", "mv"] as const

export type DebtKind = (typeof DEBT_KINDS)[number]
export type RateType = (typeof RATE_TYPES)[number]

// Tope de la tasa por tipo (checks de la tabla)
export const MAX_RATE: Record<RateType, number> = { ea: 200, mv: 10 }

// Los campos opcionales del formulario llegan como "" cuando están vacíos
const emptyToNull = (value: unknown) => (value === "" ? null : value)

// Los montos llegan como texto en es-CO ("1.500.000") y se convierten con
// parseAmount, igual que en movimientos
const toAmount = (value: unknown) =>
  typeof value === "string" ? parseAmount(value) : value

/** Tasa escrita con coma decimal ("28,5"), hasta 3 decimales */
export function parseRate(value: string) {
  const normalized = value.replace(/[%\s]/g, "").replace(",", ".")

  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) {
    return Number.NaN
  }
  return Number(normalized)
}

const amountField = z.preprocess(toAmount, amountSchema)

const optionalAmountField = z.preprocess(
  (value) => toAmount(emptyToNull(value)),
  amountSchema.nullable()
)

// Saldo que puede ser 0 (saldo inicial de una tarjeta, saldo real al ajustar)
const balanceField = z.preprocess(
  toAmount,
  z
    .number({ error: "Ingresa un monto válido" })
    .refine((value) => !Number.isNaN(value), {
      error: "Ingresa un monto válido"
    })
    .refine((value) => value >= 0, { error: "El saldo no puede ser negativo" })
    .refine((value) => value <= MAX_AMOUNT, {
      error: "El monto es demasiado grande"
    })
)

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

function dayField(message: string) {
  return z.coerce
    .number({ error: message })
    .int({ error: message })
    .min(1, { error: message })
    .max(31, { error: message })
}

const nameField = z
  .string()
  .trim()
  .min(1, { error: "Ingresa un nombre" })
  .max(60, { error: "El nombre debe tener máximo 60 caracteres" })

const counterpartyField = z
  .string()
  .trim()
  .max(60, { error: "Debe tener máximo 60 caracteres" })
  .transform((value) => value || null)

const noteField = z
  .string()
  .trim()
  .max(120, { error: "La nota debe tener máximo 120 caracteres" })
  .transform((value) => value || null)

const pastDateField = z.iso
  .date({ error: "Elige una fecha válida" })
  .refine((value) => value <= todayISO(), {
    error: "La fecha no puede ser futura"
  })

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
    )
  })
  .superRefine((data, ctx) => checkRate(data, ctx, false))
  .transform(withRateType)

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

export const receivableSchema = z.object({
  name: nameField,
  counterparty: counterpartyField,
  opening_balance: amountField,
  expected_on: z.preprocess(
    emptyToNull,
    z.iso.date({ error: "Elige una fecha válida" }).nullable()
  )
})

export const DEBT_SCHEMAS = {
  credit_card: creditCardSchema,
  loan: loanSchema,
  receivable: receivableSchema
} as const

export type CreditCardInput = z.infer<typeof creditCardSchema>
export type LoanInput = z.infer<typeof loanSchema>
export type ReceivableInput = z.infer<typeof receivableSchema>

// Pago de deuda o abono. La casilla de movimiento llega como "on" si está
// marcada; en tarjetas no existe.
export const paymentSchema = z.object({
  amount: amountField,
  occurred_on: pastDateField,
  note: noteField,
  create_transaction: z.preprocess(
    (value) => value === "on" || value === "true" || value === true,
    z.boolean()
  ),
  // Cuenta del movimiento creado. Vacío = sin cuenta.
  account_id: z.preprocess(
    emptyToNull,
    z.uuid({ error: "Elige una cuenta válida" }).nullable()
  )
})

export type PaymentInput = z.infer<typeof paymentSchema>

// "Actualizar saldo": el saldo real, no la diferencia
export const adjustBalanceSchema = z.object({
  balance: balanceField,
  occurred_on: pastDateField,
  note: noteField
})

export type AdjustBalanceInput = z.infer<typeof adjustBalanceSchema>
