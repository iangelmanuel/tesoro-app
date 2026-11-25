import type { PostgrestError } from "@supabase/supabase-js"
import type { DebtFormState } from "./types"

// Mensajes de los triggers de debts y debt_entries (check_violation) y su
// traducción a errores de formulario. Los comparten las actions y los
// servicios de deudas que usa el MCP (SPEC 34).

export const DEBT_NOT_FOUND = "No se encontró la deuda"
export const ENTRY_DEFAULT_ERROR =
  "No se pudo guardar el movimiento. Intenta de nuevo"
export const ENTRY_NOT_FOUND = "No se encontró el pago"
/**
 * Texto que lanzan los triggers y las RPC de deudas. Cambiarlo exige una
 * migración: la app lo reconoce y muestra DEBT_NOT_ACTIVE (SPEC 47)
 */
export const DEBT_NOT_ACTIVE_DB = "Reactiva la deuda para registrar pagos"
export const DEBT_NOT_ACTIVE = "Reactiva la deuda para registrar movimientos"
export const OVER_PAYMENT = "El pago supera el saldo"
export const NEGATIVE_BALANCE = "El saldo de la deuda no puede quedar negativo"
export const FUTURE_DATE = "La fecha no puede ser futura"
export const CARD_TRANSACTION = "Un pago de tarjeta no crea un movimiento"
export const ARCHIVED_ACCOUNT = "La cuenta está archivada"
export const ADVANCE_ONLY_CARD = "Solo una tarjeta admite avances"
export const SAME_TRANSFER_ACCOUNT = "Elige una cuenta distinta a la que paga"
export const INSTALLMENT_REQUIRED = "Elige la cuota que se cobra"
export const INSTALLMENT_OUT_OF_RANGE = "La cuota está fuera del cobro mensual"
export const RECEIVABLE_NOT_FOUND = "No se encontró la cuenta por cobrar"
export const COLLECT_MODE_INVALID = "Elige cómo se cobra"
export const COLLECT_OVER_BALANCE = "El cobro supera el saldo pendiente"
export const FULL_PAYMENT_MISMATCH =
  "El saldo cambió. Vuelve a abrir el cobro para ver el saldo actual"
export const INSTALLMENT_EXCEEDS = "El monto supera lo que falta de la cuota"
export const ALLOCATION_EXCEEDS_END = "El monto supera lo que falta por cobrar"
export const ALLOCATION_FUTURE_LIMIT =
  "El monto cubre más de 12 meses por delante"
export const ACCOUNT_REQUIRED = "Elige la cuenta del pago"
export const ENTRY_TYPE_INVALID =
  "Este tipo de movimiento no aplica a esta deuda"
export const AMOUNT_NOT_POSITIVE = "El monto debe ser mayor que cero"
export const INSTALLMENTS_ONLY_ADVANCE =
  "Solo las compras y avances de una tarjeta van a cuotas"
export const LINK_INVALID =
  "Ese movimiento ya no se puede enlazar. Elige otro o crea uno nuevo"

// Errores del reparto entre cuotas (SPEC 39): llegan con un hint fijo
const ALLOCATION_HINTS: Record<string, { field: string; message: string }> = {
  over_payment: { field: "amount", message: COLLECT_OVER_BALANCE },
  full_payment_mismatch: { field: "amount", message: FULL_PAYMENT_MISMATCH },
  installment_exceeds: { field: "amount", message: INSTALLMENT_EXCEEDS },
  allocation_exceeds_end: { field: "amount", message: ALLOCATION_EXCEEDS_END },
  allocation_future_limit: {
    field: "amount",
    message: ALLOCATION_FUTURE_LIMIT
  },
  installment_required: { field: "period_on", message: INSTALLMENT_REQUIRED },
  // Pago con movimiento sin cuenta, o movimiento que no se puede enlazar
  account_required: { field: "account_id", message: ACCOUNT_REQUIRED },
  link_invalid: { field: "link_transaction_id", message: LINK_INVALID },
  // Editar un movimiento de una deuda (SPEC 42, parte 3)
  kind_invalid: { field: "type", message: ENTRY_TYPE_INVALID },
  amount_not_positive: { field: "amount", message: AMOUNT_NOT_POSITIVE },
  installment_out_of_range: {
    field: "period_on",
    message: INSTALLMENT_OUT_OF_RANGE
  }
}

/**
 * Traduce un error de Postgres. `balanceField` es el campo al que se asigna
 * el error de saldo negativo.
 */
export function debtPgError(
  error: PostgrestError,
  balanceField: string,
  balanceMessage: string,
  defaultError: string
): DebtFormState {
  const allocation = error.hint ? ALLOCATION_HINTS[error.hint] : undefined
  if (allocation) {
    return { fieldErrors: { [allocation.field]: [allocation.message] } }
  }
  if (error.message.includes(NEGATIVE_BALANCE)) {
    return { fieldErrors: { [balanceField]: [balanceMessage] } }
  }
  if (error.message.includes(DEBT_NOT_ACTIVE_DB)) {
    return { error: DEBT_NOT_ACTIVE }
  }
  if (error.message.includes(FUTURE_DATE)) {
    return { fieldErrors: { occurred_on: [FUTURE_DATE] } }
  }
  if (error.message.includes(CARD_TRANSACTION)) {
    return { error: CARD_TRANSACTION }
  }
  if (error.message.includes(ADVANCE_ONLY_CARD)) {
    return { error: ADVANCE_ONLY_CARD }
  }
  // Cuotas de una compra (SPEC 42): checks de debt_entries
  if (error.message.includes("debt_entries_installments")) {
    return { fieldErrors: { installments: [INSTALLMENTS_ONLY_ADVANCE] } }
  }
  // Cuotas del cobro mensual: reglas de check_debt_entry_allocation
  if (error.message.includes("La cuota es")) {
    return { fieldErrors: { period_on: [INSTALLMENT_OUT_OF_RANGE] } }
  }
  if (error.message.includes(INSTALLMENT_REQUIRED)) {
    return { fieldErrors: { period_on: [INSTALLMENT_REQUIRED] } }
  }
  // El traspaso desde la misma cuenta que paga lo frena transfers_check
  if (error.message.includes("transfers_check")) {
    return { fieldErrors: { transfer_from: [SAME_TRANSFER_ACCOUNT] } }
  }
  // Cuenta del movimiento de un pago: archivada o de otro espacio
  if (error.message.includes(ARCHIVED_ACCOUNT)) {
    return { fieldErrors: { account_id: [ARCHIVED_ACCOUNT] } }
  }
  if (error.code === "23503" && error.message.includes("account_id")) {
    return { fieldErrors: { account_id: ["Elige una cuenta válida"] } }
  }
  if (error.code === "23503") {
    return { error: DEBT_NOT_FOUND }
  }
  if (error.code === "42501") {
    return { error: "No tienes permiso para modificar esta deuda" }
  }
  return { error: defaultError }
}
