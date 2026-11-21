import "server-only"
import { validateCategory } from "@/features/transactions/service"
import {
  type ServiceFailure,
  type ServiceResult,
  fail
} from "@/features/workspaces/service-result"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Database } from "@/types/database"
import { entryKindOf, entryTypesFor } from "./entry-types"
import {
  ACCOUNT_REQUIRED,
  CARD_TRANSACTION,
  COLLECT_MODE_INVALID,
  COLLECT_OVER_BALANCE,
  DEBT_NOT_ACTIVE,
  ENTRY_NOT_FOUND,
  ENTRY_TYPE_INVALID,
  INSTALLMENTS_ONLY_ADVANCE,
  NEGATIVE_BALANCE,
  OVER_PAYMENT,
  RECEIVABLE_NOT_FOUND,
  debtPgError
} from "./errors"
import {
  COLLECT_MODES_BY_SCHEDULE,
  type DebtEntryEditInput,
  type PaymentInput,
  type ReceivableCollectInput,
  type ReceivableSchedule
} from "./schemas"

// Deuda y abono con un cliente dado (SPEC 34): las actions lo usan con la
// sesión de cookies y el MCP con el Bearer del agente. El espacio llega
// resuelto: aquí no se lee la sesión.

export type DebtEntryRecord =
  Database["public"]["Tables"]["debt_entries"]["Row"]

const ENTRY_DEFAULT_ERROR = "No se pudo guardar el movimiento. Intenta de nuevo"
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
const TRANSACTION_ERROR = "No se pudo guardar el movimiento. Intenta de nuevo"

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
    const failure = debtPgError(
      error,
      "amount",
      OVER_PAYMENT,
      ENTRY_DEFAULT_ERROR
    )
    return fail({ error: failure.error, fieldErrors: failure.fieldErrors })
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
      const failure = debtPgError(
        txError,
        "amount",
        OVER_PAYMENT,
        TRANSACTION_ERROR
      )
      return fail({ error: failure.error, fieldErrors: failure.fieldErrors })
    }
  }
  return { ok: true, before, after }
}

/**
 * Edita una compra o avance de tarjeta con update_card_advance (SPEC 42,
 * parte 2), en una sola transacción. La cuenta decide qué es: con cuenta es
 * un avance con su ingreso (lo crea si no lo tenía, también en los avances
 * anteriores a SPEC 36 con la cuenta en el abono); sin cuenta es una compra
 * y su ingreso, si lo tenía, se borra.
 */
async function updateCardAdvance(
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
    const failure = debtPgError(
      error,
      "amount",
      NEGATIVE_BALANCE,
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
    const failure = debtPgError(
      error,
      "amount",
      OVER_PAYMENT,
      ENTRY_DEFAULT_ERROR
    )
    return fail({ error: failure.error, fieldErrors: failure.fieldErrors })
  }
  return { ok: true, entryId }
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
