import "server-only"
import { validateCategory } from "@/features/transactions/service"
import { type ServiceResult, fail } from "@/features/workspaces/service-result"
import { roundCents } from "@/libs/money"
import { moveErrorMessage } from "@/libs/move-error"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Database } from "@/types/database"
import type { DebtEntryEditInput } from "./entry-schemas"
import { entryKindOf, entryTypesFor } from "./entry-types"
import {
  ACCOUNT_REQUIRED,
  DEBT_NOT_ACTIVE,
  ENTRY_DEFAULT_ERROR,
  ENTRY_NOT_FOUND,
  ENTRY_TYPE_INVALID,
  NEGATIVE_BALANCE,
  OVER_PAYMENT,
  debtPgError
} from "./errors"

// Movimientos de una deuda con un cliente dado (SPEC 34): las actions lo
// usan con la sesión de cookies y el MCP con el Bearer del agente. El
// espacio llega resuelto: aquí no se lee la sesión. Aquí va lo común a todos
// los tipos (cargar, editar, borrar, reordenar); el pago, el avance y los
// ajustes van en entry-payment-service.ts, entry-advance-service.ts y
// entry-adjustment-service.ts, y el cobro en receivable-service.ts.

/** Fila de debt_entries: el snapshot del log de operaciones */
export type DebtEntryRecord =
  Database["public"]["Tables"]["debt_entries"]["Row"]

const DELETE_ERROR = "No se pudo eliminar. Intenta de nuevo"

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

/**
 * Reescribe cualquier movimiento de una deuda como si se registrara de nuevo
 * (SPEC 42, parte 3) con update_debt_entry, en una sola transacción: tipo,
 * monto, fecha, hora, nota, cuenta, movimiento enlazado (lo crea, lo
 * reutiliza, lo enlaza a uno ya registrado o lo borra), abono extra y
 * cuotas. Valida el tipo según la deuda, la cuenta de un pago con
 * movimiento y la categoría antes de escribir.
 */
export async function updateDebtEntryRecord(
  supabase: AppSupabase,
  entry: LoadedEntry,
  input: DebtEntryEditInput
): Promise<ServiceResult<{ before: DebtEntryRecord; after: DebtEntryRecord }>> {
  const debt = entry.debt
  if (debt.status !== "active") {
    return fail({ error: DEBT_NOT_ACTIVE })
  }

  const current =
    entry.kind === "adjustment" ? ("adjustment" as const) : undefined
  if (
    !entryTypesFor(
      { kind: debt.kind, schedule: debt.schedule },
      current
    ).includes(input.type)
  ) {
    return fail({ fieldErrors: { type: [ENTRY_TYPE_INVALID] } })
  }

  const kind = entryKindOf(input.type)
  const isCard = debt.kind === "credit_card"
  const amount =
    input.type === "adjustment" && input.direction === "down"
      ? -input.amount
      : input.amount
  // Préstamo y Me deben: el pago crea (o conserva) su gasto o ingreso
  const createTransaction =
    kind === "payment" && !isCard && input.create_transaction
  const accountId =
    input.type === "purchase" ||
    input.type === "fee" ||
    input.type === "adjustment"
      ? null
      : kind === "payment" && !isCard && !createTransaction
        ? null
        : input.account_id
  if (createTransaction && !accountId && !input.link_transaction_id) {
    return fail({ fieldErrors: { account_id: [ACCOUNT_REQUIRED] } })
  }

  // Categoría del movimiento: se valida antes de escribir
  const transactionType =
    kind === "advance" || debt.kind === "receivable" ? "income" : "expense"
  const usesTransaction =
    createTransaction || (input.type === "advance" && accountId !== null)
  const categoryId = usesTransaction ? input.category_id : null
  if (categoryId) {
    const { data: currentTx } = entry.transaction_id
      ? await supabase
          .from("transactions")
          .select("category_id")
          .eq("id", entry.transaction_id)
          .maybeSingle()
      : { data: null }
    if (categoryId !== currentTx?.category_id) {
      const categoryError = await validateCategory(
        supabase,
        categoryId,
        transactionType,
        "personal",
        currentTx?.category_id ?? undefined
      )
      if (categoryError) {
        return fail({ fieldErrors: { category_id: [categoryError] } })
      }
    }
  }

  const before = entryRecord(entry)
  // Los tipos generados no marcan los parámetros como nullable
  const { error } = await supabase.rpc("update_debt_entry", {
    p_entry_id: entry.id,
    p_kind: kind,
    p_amount: amount,
    p_occurred_on: input.occurred_on,
    p_occurred_time: input.occurred_time as string,
    p_note: input.note as string,
    p_account_id: accountId as string,
    p_create_transaction: createTransaction,
    p_is_extra_payment: input.type === "extra",
    p_installments: (kind === "advance" ? input.installments : null) as number,
    p_description: (usesTransaction
      ? input.description?.trim() || null
      : null) as string,
    p_category_id: categoryId as string,
    p_link_transaction_id: input.link_transaction_id as string
  })

  if (error) {
    const failure = debtPgError(
      error,
      "amount",
      kind === "payment" ? OVER_PAYMENT : NEGATIVE_BALANCE,
      ENTRY_DEFAULT_ERROR
    )
    return fail({ error: failure.error, fieldErrors: failure.fieldErrors })
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

/** Reordena un movimiento dentro del mismo día de su deuda (SPEC 45) */
export async function moveDebtEntryRecord(
  supabase: AppSupabase,
  id: string,
  targetId: string
): Promise<ServiceResult<object>> {
  const { error } = await supabase.rpc("move_debt_entry", {
    p_id: id,
    p_target_id: targetId
  })

  if (error) {
    return fail({ error: moveErrorMessage(error) })
  }
  return { ok: true }
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
