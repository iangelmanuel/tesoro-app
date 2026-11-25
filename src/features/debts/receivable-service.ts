import "server-only"
import {
  type ServiceFailure,
  type ServiceResult,
  fail
} from "@/features/workspaces/service-result"
import type { AppSupabase } from "@/libs/supabase/types"
import type { LoadedDebt } from "./entry-service"
import {
  COLLECT_MODE_INVALID,
  COLLECT_OVER_BALANCE,
  DEBT_NOT_ACTIVE,
  RECEIVABLE_NOT_FOUND,
  debtPgError
} from "./errors"
import {
  COLLECT_MODES_BY_SCHEDULE,
  type ReceivableCollectInput,
  type ReceivableSchedule
} from "./receivable-schemas"

// Cobro de una cuenta por cobrar (SPEC 39), con un cliente dado: lo usan las
// actions y el MCP

const COLLECT_DEFAULT_ERROR = "No se pudo guardar el cobro. Intenta de nuevo"

/**
 * Valida un cobro de cuenta por cobrar (SPEC 39) antes de llamar a la RPC:
 * cuenta por cobrar activa, modo del tipo de cobro y, con saldo total (una
 * vez o mensual con número de cuotas), que no pase de lo que falta. Lo que
 * falta en una cuota y el tope de 12 meses de una indefinida los valida la
 * RPC. Devuelve el fallo o null.
 */
export function validateReceivableCollection(
  debt: LoadedDebt,
  input: Pick<ReceivableCollectInput, "mode"> & { amount?: number }
): Omit<ServiceFailure, "ok"> | null {
  if (debt.kind !== "receivable" || debt.schedule === null) {
    return { error: RECEIVABLE_NOT_FOUND }
  }
  if (debt.status !== "active") {
    return { error: DEBT_NOT_ACTIVE }
  }
  if (
    !COLLECT_MODES_BY_SCHEDULE[debt.schedule as ReceivableSchedule].includes(
      input.mode
    )
  ) {
    return { error: COLLECT_MODE_INVALID }
  }
  if (input.mode === "full" && debt.balance <= 0) {
    return { error: COLLECT_OVER_BALANCE }
  }
  if (
    !debt.openEnded &&
    input.amount !== undefined &&
    input.amount > debt.balance
  ) {
    return { fieldErrors: { amount: [COLLECT_OVER_BALANCE] } }
  }
  return null
}

/**
 * Cobra una cuenta por cobrar con record_receivable_collection: un solo abono
 * y, si se pide, un solo ingreso en la cuenta elegida. En una mensual el
 * abono se asigna a una cuota ("single") o se reparte desde la más antigua
 * ("allocate"). "full" cobra el saldo pendiente y deja la cuenta pagada.
 */
export async function recordReceivableCollection(
  supabase: AppSupabase,
  debt: LoadedDebt,
  input: ReceivableCollectInput
): Promise<ServiceResult<{ entryId: string }>> {
  const amount = input.mode === "full" ? debt.balance : input.amount
  const invalid = validateReceivableCollection(debt, {
    mode: input.mode,
    amount
  })
  if (invalid) {
    return fail(invalid)
  }

  const { data, error } = await supabase.rpc("record_receivable_collection", {
    p_debt_id: debt.id,
    p_amount: amount,
    p_occurred_on: input.occurred_on,
    // Los tipos generados no marcan el parámetro como nullable
    p_note: input.note as string,
    p_create_transaction: input.create_transaction,
    p_account_id: input.create_transaction
      ? (input.account_id ?? undefined)
      : undefined,
    p_mode: input.mode,
    p_period_on: input.mode === "single" ? input.period_on : undefined,
    // null = "Abono {nombre}" de la RPC (SPEC 41)
    p_description: input.create_transaction
      ? (input.description ?? undefined)
      : undefined
  })

  if (error) {
    const failure = debtPgError(
      error,
      "amount",
      COLLECT_OVER_BALANCE,
      COLLECT_DEFAULT_ERROR
    )
    return fail({ error: failure.error, fieldErrors: failure.fieldErrors })
  }
  return { ok: true, entryId: data }
}
