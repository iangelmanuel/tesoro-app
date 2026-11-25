import "server-only"
import { validateCategory } from "@/features/transactions/service"
import { type ServiceResult, fail } from "@/features/workspaces/service-result"
import type { AppSupabase } from "@/libs/supabase/types"
import {
  type DebtEntryRecord,
  type LoadedDebt,
  type LoadedEntry,
  entryRecord
} from "./debt-loader"
import type { PaymentChange } from "./entry-payment-service"
import type { AdvanceInput } from "./entry-schemas"
import {
  ADVANCE_ONLY_CARD,
  DEBT_NOT_ACTIVE,
  ENTRY_DEFAULT_ERROR,
  ENTRY_NOT_FOUND,
  NEGATIVE_BALANCE,
  debtPgError
} from "./errors"

// Compras y avances de tarjeta (SPEC 36 y 42): registrar uno nuevo y editar
// uno guardado

const ADVANCE_ACCOUNT_REQUIRED = "Elige la cuenta a la que entró el avance"

/**
 * Avance o compra de tarjeta con record_card_advance: sube el saldo de la
 * deuda y, con cuenta, crea un ingreso en ella con la categoría "Avance de
 * tarjeta" enlazado al abono (SPEC 36). No lleva traspaso. Con
 * `requireAccount` (tipo "Avance" en Registrar movimiento, SPEC 46) la cuenta
 * es obligatoria: sin ella sería una compra.
 */
export async function recordCardAdvanceRecord(
  supabase: AppSupabase,
  debt: LoadedDebt,
  data: AdvanceInput,
  requireAccount: boolean
): Promise<ServiceResult<object>> {
  if (debt.status !== "active") {
    return fail({ error: DEBT_NOT_ACTIVE })
  }
  if (debt.kind !== "credit_card") {
    return fail({ error: ADVANCE_ONLY_CARD })
  }
  if (requireAccount && data.account_id === null) {
    return fail({ fieldErrors: { account_id: [ADVANCE_ACCOUNT_REQUIRED] } })
  }

  const { error } = await supabase.rpc("record_card_advance", {
    p_debt_id: debt.id,
    p_amount: data.amount,
    p_occurred_on: data.occurred_on,
    p_occurred_time: data.occurred_time ?? undefined,
    // Los tipos generados no marcan el parámetro como nullable
    p_note: data.note as string,
    p_account_id: data.account_id ?? undefined,
    p_installments: data.installments ?? undefined
  })

  if (error) {
    return fail(
      debtPgError(error, "amount", NEGATIVE_BALANCE, ENTRY_DEFAULT_ERROR)
    )
  }
  return { ok: true }
}

/**
 * Edita una compra o avance de tarjeta con update_card_advance (SPEC 42,
 * parte 2), en una sola transacción. La cuenta decide qué es: con cuenta es
 * un avance con su ingreso (lo crea si no lo tenía, también en los avances
 * anteriores a SPEC 36 con la cuenta en el abono); sin cuenta es una compra
 * y su ingreso, si lo tenía, se borra.
 */
export async function updateCardAdvance(
  supabase: AppSupabase,
  entry: LoadedEntry,
  change: PaymentChange
): Promise<ServiceResult<{ before: DebtEntryRecord; after: DebtEntryRecord }>> {
  // Categoría elegida para el ingreso: se valida antes de escribir
  const categoryId =
    change.account_id && change.category_id ? change.category_id : null
  if (categoryId) {
    const { data: current } = entry.transaction_id
      ? await supabase
          .from("transactions")
          .select("category_id")
          .eq("id", entry.transaction_id)
          .maybeSingle()
      : { data: null }
    if (categoryId !== current?.category_id) {
      const categoryError = await validateCategory(
        supabase,
        categoryId,
        "income",
        "personal",
        current?.category_id ?? undefined
      )
      if (categoryError) {
        return fail({ fieldErrors: { category_id: [categoryError] } })
      }
    }
  }

  const before = entryRecord(entry)
  // Los tipos generados no marcan los parámetros como nullable
  const { error } = await supabase.rpc("update_card_advance", {
    p_entry_id: entry.id,
    p_amount: change.amount,
    p_occurred_on: change.occurred_on,
    p_occurred_time: change.occurred_time as string,
    p_note: change.note as string,
    p_account_id: change.account_id as string,
    p_installments: (change.installments === undefined
      ? entry.installments
      : change.installments) as number,
    p_description: (change.description?.trim() || null) as string,
    p_category_id: categoryId as string
  })

  if (error) {
    return fail(
      debtPgError(error, "amount", NEGATIVE_BALANCE, ENTRY_DEFAULT_ERROR)
    )
  }

  const { data: after } = await supabase
    .from("debt_entries")
    .select("*")
    .eq("id", entry.id)
    .maybeSingle()
  if (!after) {
    return fail({ error: ENTRY_NOT_FOUND })
  }
  return { ok: true, before, after }
}
