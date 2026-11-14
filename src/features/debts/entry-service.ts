import {
  type ServiceFailure,
  type ServiceResult,
  fail
} from "@/libs/service-result"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Database } from "@/types/database"
import {
  COLLECT_MODE_INVALID,
  COLLECT_OVER_BALANCE,
  DEBT_NOT_ACTIVE,
  ENTRY_NOT_FOUND,
  NEGATIVE_BALANCE,
  OVER_PAYMENT,
  RECEIVABLE_NOT_FOUND,
  debtPgError
} from "./errors"
import {
  COLLECT_MODES_BY_SCHEDULE,
  type ReceivableCollectInput,
  type ReceivableSchedule
} from "./schemas"

// Deuda y abono con un cliente dado (SPEC 34): las actions lo usan con la
// sesión de cookies y el MCP con el Bearer del agente. El espacio llega
// resuelto: aquí no se lee la sesión.

export type DebtEntryRecord =
  Database["public"]["Tables"]["debt_entries"]["Row"]

const ENTRY_DEFAULT_ERROR = "No se pudo guardar el pago. Intenta de nuevo"
const DELETE_ERROR = "No se pudo eliminar. Intenta de nuevo"

// Los montos se suman en JS: se redondean a centavos para no arrastrar error
// de punto flotante
const roundCents = (value: number) => Math.round(value * 100) / 100

/** Deuda del espacio con su saldo actual, o null si no existe o es ajena */
export async function loadDebt(
  supabase: AppSupabase,
  workspaceId: string,
  debtId: string
) {
  const { data } = await supabase
    .from("debts")
    .select(
      "id, workspace_id, kind, status, name, opening_balance, installment, schedule, starts_on, term_months, entries:debt_entries (kind, amount, allocations:debt_entry_allocations (period_on))"
    )
    .eq("id", debtId)
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  if (!data) {
    return null
  }

  // saldo = saldo inicial − pagos + ajustes + avances
  const balance = data.entries.reduce(
    (sum, entry) =>
      entry.kind === "payment"
        ? sum - Number(entry.amount)
        : sum + Number(entry.amount),
    Number(data.opening_balance)
  )

  return {
    ...data,
    balance: roundCents(balance),
    // Mensual indefinida: sin saldo total, el saldo no limita los cobros
    openEnded:
      data.kind === "receivable" &&
      data.schedule === "monthly" &&
      data.term_months === null
  }
}

export type LoadedDebt = NonNullable<Awaited<ReturnType<typeof loadDebt>>>

/** Abono del espacio con su deuda, o null si no existe o es ajeno */
export async function loadEntry(
  supabase: AppSupabase,
  workspaceId: string,
  entryId: string
) {
  const { data } = await supabase
    .from("debt_entries")
    .select("*")
    .eq("id", entryId)
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  if (!data) {
    return null
  }

  const debt = await loadDebt(supabase, workspaceId, data.debt_id)
  return debt ? { ...data, amount: Number(data.amount), debt } : null
}

export type LoadedEntry = NonNullable<Awaited<ReturnType<typeof loadEntry>>>

/** La fila del abono sin su deuda: el snapshot del log de operaciones */
export function entryRecord(entry: LoadedEntry): DebtEntryRecord {
  const { debt, ...row } = entry
  void debt
  return row
}

export interface PaymentChange {
  amount: number
  occurred_on: string
  occurred_time: string | null
}

/**
 * Valida el cambio de monto o fecha de un abono enlazado a un movimiento con
 * las reglas del diálogo de pago: deuda activa y
 * - en un pago, que el saldo sin él cubra el monto nuevo (salvo una mensual
 *   indefinida, sin saldo total);
 * - en un avance (SPEC 36), que bajarlo no deje el saldo negativo.
 * Devuelve el mensaje o null.
 */
export function validatePaymentChange(
  entry: LoadedEntry,
  change: Pick<PaymentChange, "amount">
): string | null {
  if (entry.debt.status !== "active") {
    return DEBT_NOT_ACTIVE
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

/**
 * Cambia monto, fecha y hora de un pago o de un avance con ingreso (SPEC 36).
 * El trigger sync_debt_entry_transaction los copia a su movimiento enlazado.
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

  const before = entryRecord(entry)
  const { data, error } = await supabase
    .from("debt_entries")
    .update(change)
    .eq("id", entry.id)
    .select("*")

  if (error) {
    const failure = debtPgError(
      error,
      "amount",
      entry.kind === "advance" ? NEGATIVE_BALANCE : OVER_PAYMENT,
      ENTRY_DEFAULT_ERROR
    )
    return fail({ error: failure.error, fieldErrors: failure.fieldErrors })
  }
  const after = data[0]
  if (!after) {
    return fail({ error: ENTRY_NOT_FOUND })
  }
  return { ok: true, before, after }
}

/**
 * Borra un abono. Si el pago o el avance (SPEC 36) tiene movimiento, el
 * trigger también lo borra.
 * Borrar un ajuste, un avance o una cuota que subió el saldo lo baja: no
 * puede quedar negativo.
 */
export async function deleteEntryRecord(
  supabase: AppSupabase,
  entry: LoadedEntry
): Promise<ServiceResult<{ before: DebtEntryRecord }>> {
  if (entry.debt.status !== "active") {
    return fail({ error: DEBT_NOT_ACTIVE })
  }
  if (
    (entry.kind === "adjustment" ||
      entry.kind === "advance" ||
      entry.kind === "fee") &&
    entry.debt.balance - entry.amount < 0
  ) {
    return fail({ error: NEGATIVE_BALANCE })
  }

  const before = entryRecord(entry)
  const { data, error } = await supabase
    .from("debt_entries")
    .delete()
    .eq("id", entry.id)
    .select("id")

  if (error) {
    const failure = debtPgError(error, "amount", NEGATIVE_BALANCE, DELETE_ERROR)
    return fail({ error: failure.error ?? failure.fieldErrors?.amount?.[0] })
  }
  if (data.length === 0) {
    return fail({ error: ENTRY_NOT_FOUND })
  }
  return { ok: true, before }
}

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
    p_period_on: input.mode === "single" ? input.period_on : undefined
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

/**
 * Reparte de nuevo un abono de una mensual desde la cuota no pagada más
 * antigua (reallocate_debt_entry). Cambiar el monto ya lo reparte por
 * trigger; esto sirve para rehacer el reparto sin cambiar el abono.
 */
export async function reallocateEntry(
  supabase: AppSupabase,
  entryId: string
): Promise<
  ServiceResult<{ allocations: { period_on: string; amount: number }[] }>
> {
  const { data, error } = await supabase.rpc("reallocate_debt_entry", {
    p_entry_id: entryId
  })
  if (error) {
    const failure = debtPgError(
      error,
      "amount",
      OVER_PAYMENT,
      ENTRY_DEFAULT_ERROR
    )
    return fail({ error: failure.error, fieldErrors: failure.fieldErrors })
  }
  return {
    ok: true,
    allocations: data.map((row) => ({
      period_on: row.period_on,
      amount: Number(row.amount)
    }))
  }
}
