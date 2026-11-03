import { z } from "zod"
import { TRANSACTION_TYPES } from "@/features/categories/constants"

export const MAX_AMOUNT = 999_999_999_999.99

// Montos escritos en es-CO: "1.500.000" o "1500000,50". Se quitan el
// símbolo, los espacios y los puntos de miles, y la coma pasa a punto.
export function parseAmount(value: string) {
  const normalized = value
    .replace(/[$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return Number.NaN
  }
  return Number(normalized)
}

// Reutilizado por gastos fijos y presupuestos. Recibe el resultado de
// parseAmount.
export const amountSchema = z
  .number({ error: "Ingresa un monto válido" })
  .refine((value) => !Number.isNaN(value), {
    error: "Ingresa un monto válido"
  })
  .refine((value) => value > 0, { error: "El monto debe ser mayor a 0" })
  .refine((value) => value <= MAX_AMOUNT, {
    error: "El monto es demasiado grande"
  })

// Hora opcional de un evento (SPEC 19): HH:MM o "" sin hora, que pasa a null.
// Compartido por todos los esquemas de evento.
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida")
  .or(z.literal(""))
  .transform((value) => value || null)

// Los campos opcionales del formulario llegan como "" cuando están vacíos:
// sin cuenta o sin enlace a un gasto fijo
const emptyToNull = (value: unknown) => (value === "" ? null : value)

// Cuenta de un pago o aporte y, opcionalmente, el traspaso previo desde otra
// cuenta (SPEC 16). Vive aquí porque amountSchema y parseAmount son de este
// archivo; accounts/schemas.ts lo reexporta.
export const paymentAccountSchema = z.object({
  account_id: z.preprocess(
    emptyToNull,
    z.uuid({ error: "Elige una cuenta válida" }).nullable()
  ),
  transfer_from: z.preprocess(
    emptyToNull,
    z.uuid({ error: "Elige la cuenta de origen" }).nullable()
  ),
  transfer_amount: z.preprocess(
    (value) =>
      value === "" || value === undefined
        ? null
        : typeof value === "string"
          ? parseAmount(value)
          : value,
    amountSchema.nullable()
  )
})

type PaymentAccountInput = z.infer<typeof paymentAccountSchema>

// transfer_from exige account_id y es distinta a ella; el monto y el origen
// van juntos
export function refinePaymentAccount(
  data: PaymentAccountInput,
  ctx: z.RefinementCtx
) {
  if (data.transfer_from !== null && data.account_id === null) {
    ctx.addIssue({
      code: "custom",
      path: ["account_id"],
      message: "Elige la cuenta que paga"
    })
  }
  if (data.transfer_from !== null && data.transfer_from === data.account_id) {
    ctx.addIssue({
      code: "custom",
      path: ["transfer_from"],
      message: "Elige una cuenta distinta a la que paga"
    })
  }
  if (data.transfer_from === null && data.transfer_amount !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["transfer_from"],
      message: "Elige la cuenta de origen"
    })
  }
  if (data.transfer_from !== null && data.transfer_amount === null) {
    ctx.addIssue({
      code: "custom",
      path: ["transfer_amount"],
      message: "Ingresa el monto del traspaso"
    })
  }
}

export const transactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPES, { error: "Elige ingreso o gasto" }),
  amount: amountSchema,
  occurred_on: z.iso.date({ error: "Elige una fecha válida" }),
  category_id: z.uuid({ error: "Elige una categoría" }),
  description: z
    .string()
    .trim()
    .min(1, { error: "Ingresa una descripción" })
    .max(120, { error: "La descripción debe tener máximo 120 caracteres" }),
  note: z
    .string()
    .trim()
    .max(500, { error: "La nota debe tener máximo 500 caracteres" })
    .transform((value) => value || null),
  account_id: z.preprocess(
    emptyToNull,
    z.uuid({ error: "Elige una cuenta válida" }).nullable()
  ),
  // Solo en Empresa: cliente (venta) o proveedor (costo o gasto) y factura.
  // En Personal la action los guarda como null
  counterparty: z
    .string()
    .trim()
    .max(80, { error: "Máximo 80 caracteres" })
    .transform((value) => value || null),
  invoice_ref: z
    .string()
    .trim()
    .max(40, { error: "El número de factura debe tener máximo 40 caracteres" })
    .transform((value) => value || null)
})

// Movimiento nuevo, opcionalmente enlazado a una ocurrencia de gasto fijo
export const createTransactionSchema = transactionSchema
  .extend({
    recurring_expense_id: z.preprocess(
      emptyToNull,
      z.uuid({ error: "No se encontró el gasto fijo" }).nullable()
    ),
    recurring_due_on: z.preprocess(
      emptyToNull,
      z.iso.date({ error: "No se encontró el gasto fijo" }).nullable()
    ),
    // Traspaso previo desde otra cuenta; solo en gastos
    transfer_from: paymentAccountSchema.shape.transfer_from,
    transfer_amount: paymentAccountSchema.shape.transfer_amount
  })
  .superRefine((data, ctx) => {
    refinePaymentAccount(data, ctx)
    if (data.transfer_from !== null && data.type !== "expense") {
      ctx.addIssue({
        code: "custom",
        path: ["transfer_from"],
        message: "Solo un gasto admite traspaso"
      })
    }
  })
  .refine(
    (data) =>
      (data.recurring_expense_id === null) === (data.recurring_due_on === null),
    { error: "No se encontró el gasto fijo" }
  )

export type TransactionInput = z.infer<typeof transactionSchema>
