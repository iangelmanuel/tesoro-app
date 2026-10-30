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

// Los campos opcionales del formulario llegan como "" cuando están vacíos:
// sin cuenta o sin enlace a un gasto fijo
const emptyToNull = (value: unknown) => (value === "" ? null : value)

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
  )
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
    )
  })
  .refine(
    (data) =>
      (data.recurring_expense_id === null) === (data.recurring_due_on === null),
    { error: "No se encontró el gasto fijo" }
  )

export type TransactionInput = z.infer<typeof transactionSchema>
