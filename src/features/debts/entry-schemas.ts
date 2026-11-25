import { z } from "zod"
import {
  paymentAccountSchema,
  refinePaymentAccount,
  timeSchema
} from "@/features/transactions/schemas"
import { ENTRY_TYPES } from "./entry-types"
import { MAX_INSTALLMENTS } from "./installments"
import {
  amountField,
  balanceField,
  checkDirection,
  checkboxField,
  directionField,
  emptyToNull,
  noteField,
  pastDateField,
  paymentDescriptionField
} from "./schema-fields"

// Esquemas de los movimientos de una deuda: pago, avance, cuota de manejo,
// ajuste, actualizar saldo y editar cualquiera (SPEC 42 y 46)

// Cuotas de una compra o avance de tarjeta (SPEC 42): de 1 a 48. Vacío =
// sin cuotas (no cambia el pago del mes)
const INSTALLMENTS_ERROR = `Ingresa entre 1 y ${MAX_INSTALLMENTS} cuotas`

/** Cuotas de una compra o avance: vacío o de 1 a MAX_INSTALLMENTS */
export const installmentsField = z.preprocess(
  emptyToNull,
  z.coerce
    .number({ error: INSTALLMENTS_ERROR })
    .int({ error: INSTALLMENTS_ERROR })
    .min(1, { error: INSTALLMENTS_ERROR })
    .max(MAX_INSTALLMENTS, { error: INSTALLMENTS_ERROR })
    .nullable()
)

/**
 * Pago de deuda o abono. La casilla de movimiento llega como "on" si está
 * marcada; en tarjetas no existe. account_id es la cuenta del movimiento
 * creado o, en una tarjeta, la del pago; vacío = fuera de las cuentas.
 * is_extra_payment marca un abono extra de tarjeta o préstamo: baja el saldo
 * pero no cubre el pago mínimo o la cuota del ciclo.
 * El cobro de una cuenta por cobrar va por receivableCollectSchema (SPEC 39).
 */
export const paymentSchema = z
  .object({
    amount: amountField,
    occurred_on: pastDateField,
    occurred_time: timeSchema,
    note: noteField,
    description: paymentDescriptionField,
    create_transaction: checkboxField,
    is_extra_payment: checkboxField,
    ...paymentAccountSchema.shape
  })
  .superRefine(refinePaymentAccount)

export type PaymentInput = z.infer<typeof paymentSchema>

/**
 * Editar cualquier movimiento de una deuda (SPEC 42, parte 3), como si se
 * registrara de nuevo. El tipo decide qué campos aplican:
 * - ajuste: monto positivo + dirección (sube o baja el saldo);
 * - avance: cuenta obligatoria (la que recibe el dinero);
 * - pago o abono de préstamo o Me deben: con movimiento, la cuenta es
 *   obligatoria (lo valida el servicio, que conoce la deuda).
 * Cuenta vacía = sin cuenta; descripción y categoría vacías conservan las
 * del movimiento o usan las de siempre. link_transaction_id: un gasto o
 * ingreso ya registrado que se enlaza en vez de crear uno nuevo.
 */
export const debtEntryEditSchema = z
  .object({
    type: z.enum(ENTRY_TYPES, { error: "Elige el tipo de movimiento" }),
    amount: amountField,
    direction: directionField,
    occurred_on: pastDateField,
    occurred_time: timeSchema,
    note: noteField,
    account_id: paymentAccountSchema.shape.account_id,
    create_transaction: checkboxField,
    description: paymentDescriptionField,
    category_id: z.preprocess(
      emptyToNull,
      z.uuid({ error: "Elige una categoría válida" }).nullable()
    ),
    installments: installmentsField,
    link_transaction_id: z.preprocess(
      emptyToNull,
      z.uuid({ error: "Elige un movimiento válido" }).nullable()
    )
  })
  .superRefine((data, ctx) => {
    checkDirection(data, ctx)
    if (data.type === "advance" && data.account_id === null) {
      ctx.addIssue({
        code: "custom",
        path: ["account_id"],
        message: "Elige la cuenta a la que entró el avance"
      })
    }
  })

export type DebtEntryEditInput = z.infer<typeof debtEntryEditSchema>

/**
 * Avance de tarjeta: sube el saldo de la deuda y, con cuenta, el de la
 * cuenta. No lleva traspaso.
 */
export const advanceSchema = z.object({
  amount: amountField,
  occurred_on: pastDateField,
  occurred_time: timeSchema,
  note: noteField,
  account_id: paymentAccountSchema.shape.account_id,
  installments: installmentsField
})

export type AdvanceInput = z.infer<typeof advanceSchema>

/**
 * Cuota de manejo o ajuste nuevo desde "Registrar movimiento" (SPEC 46).
 * Monto positivo; el ajuste dice si sube o baja el saldo. No tocan cuentas
 * ni crean movimiento.
 */
export const debtChargeSchema = z
  .object({
    type: z.enum(["fee", "adjustment"], {
      error: "Elige el tipo de movimiento"
    }),
    amount: amountField,
    direction: directionField,
    occurred_on: pastDateField,
    occurred_time: timeSchema,
    note: noteField
  })
  .superRefine(checkDirection)

export type DebtChargeInput = z.infer<typeof debtChargeSchema>

/** "Actualizar saldo": el saldo real, no la diferencia */
export const adjustBalanceSchema = z.object({
  balance: balanceField,
  occurred_on: pastDateField,
  occurred_time: timeSchema,
  note: noteField
})

export type AdjustBalanceInput = z.infer<typeof adjustBalanceSchema>
