import "server-only"
import { validateCategory } from "@/features/transactions/service"
import {
  type ServiceFailure,
  type ServiceResult,
  fail
} from "@/features/workspaces/service-result"
import { roundCents } from "@/libs/money"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Database } from "@/types/database"
import {
  type DebtEntryRecord,
  type LoadedDebt,
  type LoadedEntry,
  entryRecord
} from "./debt-loader"
import { updateCardAdvance } from "./entry-advance-service"
import type { PaymentInput } from "./entry-schemas"
import {
  CARD_TRANSACTION,
  DEBT_NOT_ACTIVE,
  ENTRY_DEFAULT_ERROR,
  ENTRY_NOT_FOUND,
  INSTALLMENTS_ONLY_ADVANCE,
  NEGATIVE_BALANCE,
  OVER_PAYMENT,
  debtPgError
} from "./errors"

// Pagos y abonos de una deuda (SPEC 34 y 42): registrar uno nuevo y editar
// uno guardado. Editar un avance pasa a entry-advance-service.ts.

/**
 * Cambio completo de un pago o de un avance con ingreso (SPEC 42).
 * - account_id: en una tarjeta, la cuenta del pago (debt_entries.account_id);
 *   con movimiento, la cuenta del movimiento; null = fuera de las cuentas.
 * - description: la del movimiento; null o vacía conserva la actual.
 * - note: la del abono y la de su movimiento.
 * - category_id: la del movimiento; null conserva la actual.
 * - is_extra_payment: solo en pagos de préstamos y tarjetas.
 * - installments: cuotas de una compra o avance (SPEC 42, parte 2); ausente
 *   conserva las actuales.
 */
export interface PaymentChange {
  amount: number
  occurred_on: string
  occurred_time: string | null
  account_id: string | null
  description: string | null
  note: string | null
  category_id: string | null
  is_extra_payment: boolean
  installments?: number | null
}

const NOT_EDITABLE = "Este movimiento se edita desde Actualizar saldo"
const RECEIVABLE_EXTRA = "Una cuenta por cobrar no tiene abonos extra"
const ADVANCE_EXTRA = "Un avance no es un abono extra"
const NO_TRANSACTION_ACCOUNT =
  "Este pago no tiene movimiento: no se le puede asignar una cuenta"

/**
 * Valida el cambio de un pago o de un avance con las reglas del diálogo de
 * pago: deuda activa y
 * - en un pago, que el saldo sin él cubra el monto nuevo (salvo una mensual
 *   indefinida, sin saldo total);
 * - en un avance (SPEC 36), que bajarlo no deje el saldo negativo;
 * - abono extra solo en pagos de préstamos y tarjetas.
 * Devuelve el mensaje o null.
 */
export function validatePaymentChange(
  entry: LoadedEntry,
  change: Pick<PaymentChange, "amount"> &
    Partial<Pick<PaymentChange, "is_extra_payment" | "installments">>
): string | null {
  if (entry.debt.status !== "active") {
    return DEBT_NOT_ACTIVE
  }
  if (entry.kind !== "payment" && entry.kind !== "advance") {
    return NOT_EDITABLE
  }
  if (entry.kind !== "advance" && change.installments != null) {
    return INSTALLMENTS_ONLY_ADVANCE
  }
  if (change.is_extra_payment) {
    if (entry.kind === "advance") {
      return ADVANCE_EXTRA
    }
    if (entry.debt.kind === "receivable") {
      return RECEIVABLE_EXTRA
    }
  }
  if (entry.kind === "advance") {
    return roundCents(entry.debt.balance - entry.amount + change.amount) < 0
      ? NEGATIVE_BALANCE
      : null
  }
  if (
    !entry.debt.openEnded &&
    change.amount > roundCents(entry.debt.balance + entry.amount)
  ) {
    return OVER_PAYMENT
  }
  return null
}

type TransactionPatch = Partial<
  Pick<
    Database["public"]["Tables"]["transactions"]["Update"],
    "account_id" | "description" | "note" | "category_id"
  >
>

/**
 * Campos del movimiento enlazado que cambian: cuenta, descripción, nota y
 * categoría. Solo los distintos, así un cambio que no los toca no escribe.
 * Devuelve el parche o el fallo de la categoría.
 */
async function transactionPatch(
  supabase: AppSupabase,
  transactionId: string,
  change: PaymentChange
): Promise<
  | { ok: true; patch: TransactionPatch }
  | { ok: false; failure: Omit<ServiceFailure, "ok"> }
> {
  const { data: current } = await supabase
    .from("transactions")
    .select("type, account_id, description, note, category_id")
    .eq("id", transactionId)
    .maybeSingle()

  if (!current) {
    return { ok: false, failure: { error: ENTRY_NOT_FOUND } }
  }

  const patch: TransactionPatch = {}
  if (change.account_id !== current.account_id) {
    patch.account_id = change.account_id
  }
  const description = change.description?.trim()
  if (description && description !== current.description) {
    patch.description = description
  }
  if (change.note !== current.note) {
    patch.note = change.note
  }
  if (change.category_id && change.category_id !== current.category_id) {
    // Los pagos de deuda solo existen en Personal
    const categoryError = await validateCategory(
      supabase,
      change.category_id,
      current.type,
      "personal",
      current.category_id
    )
    if (categoryError) {
      return {
        ok: false,
        failure: { fieldErrors: { category_id: [categoryError] } }
      }
    }
    patch.category_id = change.category_id
  }
  return { ok: true, patch }
}

/**
 * Edita un pago (SPEC 42). Las compras y avances van por updateCardAdvance.
 * - El abono guarda monto, fecha, hora, nota, abono extra y, en una tarjeta,
 *   la cuenta. El trigger sync_debt_entry_transaction copia monto, fecha y
 *   hora al movimiento; en una mensual, cambiar el monto reparte de nuevo
 *   las cuotas (SPEC 39).
 * - Si hay movimiento, aquí se le cambian cuenta, descripción, nota y
 *   categoría. Si eso falla, el abono vuelve a como estaba.
 */
export async function updatePaymentEntry(
  supabase: AppSupabase,
  entry: LoadedEntry,
  change: PaymentChange
): Promise<ServiceResult<{ before: DebtEntryRecord; after: DebtEntryRecord }>> {
  const invalid = validatePaymentChange(entry, change)
  if (invalid) {
    return fail({ error: invalid })
  }
  if (entry.kind === "advance") {
    return updateCardAdvance(supabase, entry, change)
  }

  const isCardPayment =
    entry.kind === "payment" && entry.debt.kind === "credit_card"
  if (!isCardPayment && !entry.transaction_id && change.account_id) {
    return fail({ fieldErrors: { account_id: [NO_TRANSACTION_ACCOUNT] } })
  }

  // Se valida el movimiento antes de escribir nada
  let patch: TransactionPatch = {}
  if (entry.transaction_id) {
    const result = await transactionPatch(
      supabase,
      entry.transaction_id,
      change
    )
    if (!result.ok) {
      return fail(result.failure)
    }
    patch = result.patch
  }

  const before = entryRecord(entry)
  const { data, error } = await supabase
    .from("debt_entries")
    .update({
      amount: change.amount,
      occurred_on: change.occurred_on,
      occurred_time: change.occurred_time,
      note: change.note,
      is_extra_payment: change.is_extra_payment,
      ...(isCardPayment ? { account_id: change.account_id } : {})
    })
    .eq("id", entry.id)
    .select("*")

  if (error) {
    return fail(debtPgError(error, "amount", OVER_PAYMENT, ENTRY_DEFAULT_ERROR))
  }
  const after = data[0]
  if (!after) {
    return fail({ error: ENTRY_NOT_FOUND })
  }

  if (entry.transaction_id && Object.keys(patch).length > 0) {
    const { data: updated, error: txError } = await supabase
      .from("transactions")
      .update(patch)
      .eq("id", entry.transaction_id)
      .select("id")

    if (txError || updated.length === 0) {
      // Deshace el abono: el trigger devuelve también monto y fecha al
      // movimiento
      await supabase
        .from("debt_entries")
        .update({
          amount: before.amount,
          occurred_on: before.occurred_on,
          occurred_time: before.occurred_time,
          note: before.note,
          is_extra_payment: before.is_extra_payment
        })
        .eq("id", entry.id)

      if (!txError) {
        return fail({ error: ENTRY_NOT_FOUND })
      }
      return fail(
        debtPgError(txError, "amount", OVER_PAYMENT, ENTRY_DEFAULT_ERROR)
      )
    }
  }
  return { ok: true, before, after }
}

const RECEIVABLE_TRANSFER = "Un abono no admite traspaso"

/**
 * Pago de tarjeta o préstamo, o abono de cuenta por cobrar, con
 * record_debt_payment. El movimiento, si se pide, se crea en la misma
 * transacción. La cuenta es la del abono en una tarjeta y la del movimiento
 * en un préstamo o una cuenta por cobrar; sin movimiento no aplica.
 */
export async function recordDebtPaymentRecord(
  supabase: AppSupabase,
  debt: LoadedDebt,
  data: PaymentInput
): Promise<ServiceResult<{ entryId: string }>> {
  if (debt.status !== "active") {
    return fail({ error: DEBT_NOT_ACTIVE })
  }
  if (debt.kind === "credit_card" && data.create_transaction) {
    return fail({ error: CARD_TRANSACTION })
  }
  if (!debt.openEnded && data.amount > debt.balance) {
    return fail({ fieldErrors: { amount: [OVER_PAYMENT] } })
  }
  if (debt.kind === "receivable" && data.transfer_from) {
    return fail({ fieldErrors: { transfer_from: [RECEIVABLE_TRANSFER] } })
  }
  if (debt.kind === "receivable" && data.is_extra_payment) {
    return fail({ error: RECEIVABLE_EXTRA })
  }

  const accountId =
    debt.kind === "credit_card" || data.create_transaction
      ? (data.account_id ?? undefined)
      : undefined
  const hasTransfer = accountId !== undefined && data.transfer_from

  const { data: entryId, error } = await supabase.rpc("record_debt_payment", {
    p_debt_id: debt.id,
    p_amount: data.amount,
    p_occurred_on: data.occurred_on,
    p_occurred_time: data.occurred_time ?? undefined,
    // Los tipos generados no marcan el parámetro como nullable
    p_note: data.note as string,
    p_create_transaction: data.create_transaction,
    p_account_id: accountId,
    p_transfer_from: hasTransfer
      ? (data.transfer_from ?? undefined)
      : undefined,
    p_transfer_amount: hasTransfer
      ? (data.transfer_amount ?? undefined)
      : undefined,
    p_is_extra_payment: data.is_extra_payment,
    // Solo con movimiento; null = texto de la RPC (SPEC 41)
    p_description: data.create_transaction
      ? (data.description ?? undefined)
      : undefined
  })

  if (error) {
    return fail(debtPgError(error, "amount", OVER_PAYMENT, ENTRY_DEFAULT_ERROR))
  }
  return { ok: true, entryId }
}
