import type { PostgrestError } from "@supabase/supabase-js"
import { type ServiceFailure, fail } from "@/features/workspaces/service-result"

// Mensajes de error de los movimientos y traducción de los errores de
// Postgres a errores de formulario (SPEC 34). Puro: se prueba sin BD.

/** Error cuando el movimiento no existe o no es del espacio */
export const NOT_FOUND = "No se encontró el movimiento"
/** Error genérico al guardar un movimiento */
export const DEFAULT_ERROR =
  "No se pudo guardar el movimiento. Intenta de nuevo"
/** Error genérico al borrar un movimiento */
export const DELETE_ERROR =
  "No se pudo eliminar el movimiento. Intenta de nuevo"
/** La categoría no existe o no es del tipo o del espacio del movimiento */
export const INVALID_CATEGORY = "Elige una categoría válida para este tipo"
/** La categoría está archivada y no es la actual del movimiento */
export const ARCHIVED_CATEGORY = "Esta categoría está archivada. Elige otra"
/** El gasto fijo no existe o no es del espacio */
export const RECURRING_NOT_FOUND = "No se encontró el gasto fijo"
/** La ocurrencia del gasto fijo ya tiene pago */
export const ALREADY_PAID = "Este pago ya está registrado"
/** Un pago de gasto fijo debe ser una salida */
export const RECURRING_MUST_BE_EXPENSE =
  "El pago de un gasto fijo debe ser una salida"
/** El ingreso fijo no existe, no es del espacio o no está activo */
export const INCOME_NOT_FOUND = "No se encontró el ingreso fijo"
/**
 * El movimiento tiene un abono enlazado: se edita y borra desde el diálogo
 * del pago (SPEC 26)
 */
export const LINKED_DEBT_ENTRY =
  "Este movimiento es un pago o avance de deuda: edítalo desde su diálogo de pago"

const ARCHIVED_ACCOUNT = "La cuenta está archivada"
const INVALID_ACCOUNT = "Elige una cuenta válida"
const SAME_TRANSFER_ACCOUNT = "Elige una cuenta distinta a la que paga"
const UNIQUE_VIOLATION = "23505"

// Códigos de Postgres que pueden llegar pese a la validación con Zod
const PG_ERROR_MESSAGES: Record<string, Omit<ServiceFailure, "ok">> = {
  // check_transaction_category y los check de la tabla
  "23514": { fieldErrors: { category_id: [INVALID_CATEGORY] } },
  // FK de category_id
  "23503": { fieldErrors: { category_id: [INVALID_CATEGORY] } },
  // RLS
  "42501": { error: "No tienes permiso para modificar este movimiento" }
}

// allocate_income_receipt marca con `hint` por qué sobró monto al repartir
// (SPEC 38); el mensaje va al campo del monto
const ALLOCATION_HINTS = new Set([
  "allocation_future_limit",
  "allocation_exceeds_end"
])

/** Error de Postgres → error general o del campo que lo causó */
export function toServiceError(error: PostgrestError): ServiceFailure {
  if (ALLOCATION_HINTS.has(error.hint)) {
    return fail({ fieldErrors: { amount: [error.message] } })
  }
  // Índice único por ocurrencia: el pago ya existe (p. ej. doble clic)
  if (error.code === UNIQUE_VIOLATION) {
    return fail({ error: ALREADY_PAID })
  }
  // check_account_active y la FK compuesta de la cuenta, antes que los
  // códigos genéricos de la categoría
  if (error.message.includes(ARCHIVED_ACCOUNT)) {
    return fail({ fieldErrors: { account_id: [ARCHIVED_ACCOUNT] } })
  }
  if (error.code === "23503" && error.message.includes("account_id")) {
    return fail({ fieldErrors: { account_id: [INVALID_ACCOUNT] } })
  }
  // El traspaso desde la misma cuenta que paga lo frena transfers_check
  if (error.message.includes("transfers_check")) {
    return fail({ fieldErrors: { transfer_from: [SAME_TRANSFER_ACCOUNT] } })
  }
  return fail(PG_ERROR_MESSAGES[error.code] ?? { error: DEFAULT_ERROR })
}
