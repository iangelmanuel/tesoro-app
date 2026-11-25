import { z } from "zod"
import {
  MAX_AMOUNT,
  amountSchema,
  parseAmount
} from "@/features/transactions/schemas"
import { todayISO } from "@/libs/dates"
import { ADJUSTMENT_DIRECTIONS } from "./entry-types"
import { FUTURE_DATE } from "./errors"

// Campos de formulario que comparten los esquemas de deudas, cuentas por
// cobrar y movimientos (SPEC 55b)

/** Los campos opcionales del formulario llegan como "" cuando están vacíos */
export const emptyToNull = (value: unknown) => (value === "" ? null : value)

/**
 * Los montos llegan como texto en es-CO ("1.500.000") y se convierten con
 * parseAmount, igual que en movimientos
 */
export const toAmount = (value: unknown) =>
  typeof value === "string" ? parseAmount(value) : value

/** Monto obligatorio mayor que 0, escrito en es-CO */
export const amountField = z.preprocess(toAmount, amountSchema)

/** Monto opcional: vacío = null */
export const optionalAmountField = z.preprocess(
  (value) => toAmount(emptyToNull(value)),
  amountSchema.nullable()
)

/** Saldo que puede ser 0 (saldo inicial de una tarjeta, saldo real al ajustar) */
export const balanceField = z.preprocess(
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

/** Día del mes entre 1 y 31, con el mensaje de cada campo */
export function dayField(message: string) {
  return z.coerce
    .number({ error: message })
    .int({ error: message })
    .min(1, { error: message })
    .max(31, { error: message })
}

/** Nombre obligatorio, máximo 60 caracteres */
export const nameField = z
  .string()
  .trim()
  .min(1, { error: "Ingresa un nombre" })
  .max(60, { error: "El nombre debe tener máximo 60 caracteres" })

/** Entidad o persona, opcional: vacía = null */
export const counterpartyField = z
  .string()
  .trim()
  .max(60, { error: "Debe tener máximo 60 caracteres" })
  .transform((value) => value || null)

/** Nota opcional, máximo 120 caracteres: vacía = null */
export const noteField = z
  .string()
  .trim()
  .max(120, { error: "La nota debe tener máximo 120 caracteres" })
  .transform((value) => value || null)

/**
 * Descripción del movimiento que crea un pago o cobro (SPEC 41). Vacía o
 * ausente: la RPC usa su texto ("Pago {nombre}" / "Abono {nombre}")
 */
export const paymentDescriptionField = z
  .string()
  .trim()
  .max(120, { error: "La descripción debe tener máximo 120 caracteres" })
  .transform((value) => value || null)
  .optional()

/** Fecha YYYY-MM-DD de hoy o antes */
export const pastDateField = z.iso
  .date({ error: "Elige una fecha válida" })
  .refine((value) => value <= todayISO(), { error: FUTURE_DATE })

/** Casilla o campo oculto: "on" o "true" = marcado */
export const checkboxField = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean()
)

/**
 * Monto obligatorio mayor que 0 con sus mensajes: `required` si falta o no
 * es un número y `positive` si es 0 o menos
 */
export function positiveAmountField(required: string, positive: string) {
  return z.preprocess(
    toAmount,
    z
      .number({ error: required })
      .refine((value) => !Number.isNaN(value), { error: required })
      .refine((value) => value > 0, { error: positive })
      .refine((value) => value <= MAX_AMOUNT, {
        error: "El monto es demasiado grande"
      })
  )
}

/** Plazo o cuotas entre 1 y 600, opcional: vacío = null */
export function termField(message: string) {
  return z.preprocess(
    emptyToNull,
    z.coerce
      .number({ error: message })
      .int({ error: message })
      .min(1, { error: message })
      .max(600, { error: message })
      .nullable()
  )
}

const DIRECTION_REQUIRED = "Elige si el ajuste sube o baja el saldo"

/** Si un ajuste sube o baja el saldo; vacío = null (solo aplica al ajuste) */
export const directionField = z.preprocess(
  emptyToNull,
  z.enum(ADJUSTMENT_DIRECTIONS, { error: DIRECTION_REQUIRED }).nullable()
)

/** El ajuste necesita dirección */
export function checkDirection(
  data: { type: string; direction: string | null },
  ctx: z.RefinementCtx
) {
  if (data.type === "adjustment" && data.direction === null) {
    ctx.addIssue({
      code: "custom",
      path: ["direction"],
      message: DIRECTION_REQUIRED
    })
  }
}
