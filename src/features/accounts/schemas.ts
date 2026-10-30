import { z } from "zod"
import {
  CATEGORY_COLOR_KEYS,
  CATEGORY_ICON_KEYS
} from "@/features/categories/constants"
import {
  MAX_AMOUNT,
  amountSchema,
  parseAmount
} from "@/features/transactions/schemas"
import { ACCOUNT_KINDS } from "./constants"

// Saldo con signo opcional ("-50.000"): una cuenta puede estar sobregirada.
// Vacío cuenta como 0.
export function parseSignedAmount(value: string) {
  const trimmed = value.trim()
  if (trimmed === "") {
    return 0
  }
  const negative = trimmed.startsWith("-")
  const amount = parseAmount(negative ? trimmed.slice(1) : trimmed)
  return negative ? -amount : amount
}

const toSignedAmount = (value: unknown) =>
  typeof value === "string" ? parseSignedAmount(value) : value

const balanceField = z.preprocess(
  toSignedAmount,
  z
    .number({ error: "Ingresa un monto válido" })
    .refine((value) => !Number.isNaN(value), {
      error: "Ingresa un monto válido"
    })
    .refine((value) => Math.abs(value) <= MAX_AMOUNT, {
      error: "El monto es demasiado grande"
    })
)

const noteField = z
  .string()
  .trim()
  .max(120, { error: "La nota debe tener máximo 120 caracteres" })
  .transform((value) => value || null)

export const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Ingresa un nombre" })
    .max(40, { error: "El nombre debe tener máximo 40 caracteres" }),
  kind: z.enum(ACCOUNT_KINDS, { error: "Elige un tipo" }),
  icon: z.enum(CATEGORY_ICON_KEYS, { error: "Elige un icono" }),
  color: z.enum(CATEGORY_COLOR_KEYS, { error: "Elige un color" }),
  opening_balance: balanceField
})

export type AccountInput = z.infer<typeof accountSchema>

// Traspaso entre dos cuentas propias. La fecha puede ser futura: cuenta en
// "Con lo programado" hasta que llegue.
export const transferSchema = z
  .object({
    from_account_id: z.uuid({ error: "Elige la cuenta de origen" }),
    to_account_id: z.uuid({ error: "Elige la cuenta de destino" }),
    amount: z.preprocess(
      (value) => (typeof value === "string" ? parseAmount(value) : value),
      amountSchema
    ),
    occurred_on: z.iso.date({ error: "Elige una fecha válida" }),
    note: noteField
  })
  .refine((data) => data.from_account_id !== data.to_account_id, {
    path: ["to_account_id"],
    error: "Elige una cuenta distinta a la de origen"
  })

export type TransferInput = z.infer<typeof transferSchema>

// "Actualizar saldo": el saldo real, no la diferencia
export const adjustAccountSchema = z.object({
  balance: balanceField,
  note: noteField
})

export type AdjustAccountInput = z.infer<typeof adjustAccountSchema>
