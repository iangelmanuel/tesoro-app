import "server-only"
import { type ServiceResult, fail } from "@/features/workspaces/service-result"
import { roundCents } from "@/libs/money"
import type { AppSupabase } from "@/libs/supabase/types"
import type { AdjustBalanceInput, DebtChargeInput } from "./entry-schemas"
import type { LoadedDebt } from "./entry-service"
import { entryTypesFor } from "./entry-types"
import {
  DEBT_NOT_ACTIVE,
  ENTRY_DEFAULT_ERROR,
  ENTRY_TYPE_INVALID,
  NEGATIVE_BALANCE,
  debtPgError
} from "./errors"

// Cuotas de manejo y ajustes de una deuda: suben o bajan el saldo sin tocar
// cuentas ni crear movimiento

const SAME_BALANCE = "El saldo ya es ese"

/**
 * "Actualizar saldo": crea un ajuste por la diferencia entre el saldo real y
 * el actual
 */
export async function adjustBalanceRecord(
  supabase: AppSupabase,
  debt: LoadedDebt,
  data: AdjustBalanceInput
): Promise<ServiceResult<object>> {
  if (debt.status !== "active") {
    return fail({ error: DEBT_NOT_ACTIVE })
  }

  const amount = roundCents(data.balance - debt.balance)
  if (amount === 0) {
    return fail({ fieldErrors: { balance: [SAME_BALANCE] } })
  }

  const { error } = await supabase.from("debt_entries").insert({
    workspace_id: debt.workspace_id,
    debt_id: debt.id,
    kind: "adjustment",
    amount,
    occurred_on: data.occurred_on,
    occurred_time: data.occurred_time,
    note: data.note
  })

  if (error) {
    return fail(
      debtPgError(error, "balance", NEGATIVE_BALANCE, ENTRY_DEFAULT_ERROR)
    )
  }
  return { ok: true }
}

/**
 * Cuota de manejo o ajuste nuevo desde "Registrar movimiento" (SPEC 46). La
 * cuota de manejo solo existe en tarjetas; el ajuste, en los tipos que lo
 * admiten (entryTypesFor)
 */
export async function recordDebtChargeRecord(
  supabase: AppSupabase,
  debt: LoadedDebt,
  data: DebtChargeInput
): Promise<ServiceResult<object>> {
  if (debt.status !== "active") {
    return fail({ error: DEBT_NOT_ACTIVE })
  }
  if (!entryTypesFor(debt).includes(data.type)) {
    return fail({ fieldErrors: { type: [ENTRY_TYPE_INVALID] } })
  }

  const amount =
    data.type === "adjustment" && data.direction === "down"
      ? -data.amount
      : data.amount

  const { error } = await supabase.from("debt_entries").insert({
    workspace_id: debt.workspace_id,
    debt_id: debt.id,
    kind: data.type,
    amount,
    occurred_on: data.occurred_on,
    occurred_time: data.occurred_time,
    note: data.note
  })

  if (error) {
    return fail(
      debtPgError(error, "amount", NEGATIVE_BALANCE, ENTRY_DEFAULT_ERROR)
    )
  }
  return { ok: true }
}
