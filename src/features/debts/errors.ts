import type { PostgrestError } from "@supabase/supabase-js"
import type { DebtFormState } from "./types"

// Mensajes de los triggers de debts y debt_entries (check_violation) y su
// traducción a errores de formulario. Los comparten las actions y el
// servicio de abonos que usa el MCP (SPEC 34).

export const DEBT_NOT_FOUND = "No se encontró la deuda"
export const ENTRY_NOT_FOUND = "No se encontró el pago"
export const DEBT_NOT_ACTIVE = "Reactiva la deuda para registrar pagos"
export const OVER_PAYMENT = "El pago supera el saldo"
export const NEGATIVE_BALANCE = "El saldo de la deuda no puede quedar negativo"
export const FUTURE_DATE = "La fecha no puede ser futura"
export const CARD_TRANSACTION = "Un pago de tarjeta no crea un movimiento"
export const ARCHIVED_ACCOUNT = "La cuenta está archivada"
export const ADVANCE_ONLY_CARD = "Solo una tarjeta admite avances"
export const SAME_TRANSFER_ACCOUNT = "Elige una cuenta distinta a la que paga"
export const INSTALLMENT_REQUIRED = "Elige la cuota que se cobra"
export const INSTALLMENT_OUT_OF_RANGE = "La cuota está fuera del cobro mensual"

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
  if (error.message.includes(NEGATIVE_BALANCE)) {
    return { fieldErrors: { [balanceField]: [balanceMessage] } }
  }
  if (error.message.includes(DEBT_NOT_ACTIVE)) {
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
  // Cuotas del cobro mensual: reglas de check_debt_entry
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
