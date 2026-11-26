import { DEBT_NOT_ACTIVE, DEBT_NOT_ACTIVE_DB } from "@/features/debts/errors"

// Mensajes de error de la importación (SPEC 08 y 08b) y la traducción de los
// errores de Postgres y de las RPC. Lógica pura.

/** Error genérico al confirmar una importación */
export const DEFAULT_ERROR = "No se pudo importar el archivo. Intenta de nuevo"
/** Una categoría elegida no existe, no es visible o no es del tipo */
export const INVALID_CATEGORY =
  "Una de las categorías elegidas no es válida. Revisa el mapeo de categorías"
/** Una categoría elegida está archivada */
export const ARCHIVED_CATEGORY =
  "Una de las categorías elegidas está archivada. Elige otra"
const DUPLICATE_CATEGORY =
  "Ya existe una categoría con uno de los nombres nuevos. Mapéala a la existente"
/** Una cuenta elegida no existe o está archivada */
export const INVALID_ACCOUNT =
  "Una de las cuentas elegidas no es válida o está archivada. Revisa el mapeo de cuentas"
const DUPLICATE_ACCOUNT =
  "Ya existe una cuenta con uno de los nombres nuevos (puede estar archivada). Mapéala a la existente o restáurala"
/** La importación a deshacer no existe o es ajena */
export const UNDO_NOT_FOUND = "No se encontró la importación"
const UNDO_ERROR = "No se pudo deshacer la importación. Intenta de nuevo"
/** No se pudieron leer los registros existentes para marcar duplicados */
export const DUPLICATES_ERROR =
  "No se pudieron revisar los duplicados. Intenta de nuevo"
/** Una deuda elegida ya no está activa */
export const INACTIVE_DEBT =
  "Una de las deudas elegidas ya no está activa. Revisa el mapeo de deudas"
/** Una meta elegida ya no está activa */
export const INACTIVE_GOAL =
  "Una de las metas elegidas ya no está activa. Revisa el mapeo de metas"
/** Rango de fechas de la revisión de duplicados no válido */
export const INVALID_RANGE = "Rango de fechas inválido"

/** Error de Postgres o de una RPC, lo mínimo que se lee de él */
export interface ImportDbError {
  code: string
  message: string
}

// Códigos de Postgres que pueden llegar pese a la validación con Zod
const PG_ERROR_MESSAGES: Record<string, string> = {
  // check_transaction_category y los check de la tabla
  "23514": INVALID_CATEGORY,
  // FK de category_id
  "23503": INVALID_CATEGORY,
  // Índice único de categories (nombre por espacio y tipo)
  "23505": DUPLICATE_CATEGORY,
  // Verificación de dueño de la RPC
  "42501": "No tienes permiso para importar en este espacio"
}

// Mensajes de las RPC y de los triggers de deudas y metas (SPEC 05, 06 y
// 08b) que se muestran tal cual
const RPC_MESSAGES = new Set([
  "La deuda no existe",
  "La meta no existe",
  DEBT_NOT_ACTIVE_DB,
  "Reactiva la meta para registrar aportes",
  "La fecha no puede ser futura",
  "La fecha del aporte no puede ser futura",
  "El saldo de la deuda no puede quedar negativo",
  "No puedes retirar más de lo ahorrado",
  "Máximo 2.000 filas por importación"
])

// La BD dice "registrar pagos"; la UI, "registrar movimientos" (SPEC 47)
function shownRpcMessage(message: string) {
  return message === DEBT_NOT_ACTIVE_DB ? DEBT_NOT_ACTIVE : message
}

/** Error de import_recurring_expenses, de deudas o de metas para el usuario */
export function rpcErrorMessage(error: ImportDbError) {
  if (RPC_MESSAGES.has(error.message)) return shownRpcMessage(error.message)
  return PG_ERROR_MESSAGES[error.code] ?? DEFAULT_ERROR
}

/**
 * Error de import_transactions para el usuario: los de las cuentas antes que
 * los códigos genéricos de categoría
 */
export function transactionImportErrorMessage(error: ImportDbError) {
  if (error.message.includes("accounts_unique_name")) {
    return DUPLICATE_ACCOUNT
  }
  if (
    error.message.includes("La cuenta está archivada") ||
    (error.code === "23503" && error.message.includes("account_id"))
  ) {
    return INVALID_ACCOUNT
  }
  return PG_ERROR_MESSAGES[error.code] ?? DEFAULT_ERROR
}

/** Error de undo_import para el usuario */
export function undoErrorMessage(error: ImportDbError) {
  // no_data_found (P0002): ajena o inexistente
  if (error.code === "P0002") return UNDO_NOT_FOUND
  if (error.message === "La importación ya se deshizo") {
    return "Esta importación ya se deshizo"
  }
  // undo_import nombra la deuda o meta que impide deshacer
  if (error.code === "23514" && error.message.includes("«")) {
    return error.message
  }
  if (RPC_MESSAGES.has(error.message)) return shownRpcMessage(error.message)
  return UNDO_ERROR
}
