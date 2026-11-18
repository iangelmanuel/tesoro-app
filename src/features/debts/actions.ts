"use server"

import { z } from "zod"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/libs/revalidate"
import { createClient } from "@/libs/supabase/server"
import type { DebtStatus } from "./calculations"
import {
  type LoadedEntry,
  deleteEntryRecord,
  loadDebt,
  loadEntry,
  recordDebtPaymentRecord,
  recordReceivableCollection,
  updateDebtEntryRecord
} from "./entry-service"
import { type EntryType, entryKindOf } from "./entry-types"
import {
  ADVANCE_ONLY_CARD,
  DEBT_NOT_ACTIVE,
  DEBT_NOT_FOUND,
  ENTRY_NOT_FOUND,
  NEGATIVE_BALANCE,
  RECEIVABLE_NOT_FOUND,
  debtPgError
} from "./errors"
import {
  type DebtEntry,
  type LinkableTransaction,
  findLinkableTransactions,
  getDebtEntry
} from "./queries"
import {
  DEBT_KINDS,
  type DebtKind,
  type ReceivableSchedule,
  adjustBalanceSchema,
  advanceSchema,
  debtEntryEditSchema,
  paymentSchema,
  receivableCollectSchema,
  receivableScheduleSchema
} from "./schemas"
import {
  createDebtRecord,
  debtFieldsFor,
  parseDebtInput,
  updateDebtRecord
} from "./service"
import type {
  AdjustBalanceFormState,
  DebtActionResult,
  DebtFormState,
  PaymentFormState
} from "./types"

const ENTRY_DEFAULT_ERROR = "No se pudo guardar el pago. Intenta de nuevo"
const HAS_BALANCE = "La deuda aún tiene saldo"
const SAME_BALANCE = "El saldo ya es ese"

const PAYMENT_FIELDS = [
  "amount",
  "occurred_on",
  "occurred_time",
  "note",
  "description",
  "create_transaction",
  "is_extra_payment",
  "account_id",
  "transfer_from",
  "transfer_amount"
] as const

const COLLECT_FIELDS = [
  "mode",
  "amount",
  "period_on",
  "occurred_on",
  "note",
  "description",
  "create_transaction",
  "account_id"
] as const

// Editar cualquier movimiento de una deuda (SPEC 42, parte 3)
const ENTRY_EDIT_FIELDS = [
  "type",
  "amount",
  "direction",
  "occurred_on",
  "occurred_time",
  "note",
  "account_id",
  "create_transaction",
  "description",
  "category_id",
  "installments",
  "link_transaction_id"
] as const

const ADVANCE_FIELDS = [
  "amount",
  "occurred_on",
  "occurred_time",
  "note",
  "account_id",
  "installments"
] as const

const ADJUST_FIELDS = [
  "balance",
  "occurred_on",
  "occurred_time",
  "note"
] as const

const idSchema = z.uuid()
const kindSchema = z.enum(DEBT_KINDS)

// Los montos se suman en JS: se redondean a centavos para no arrastrar error
// de punto flotante
const roundCents = (value: number) => Math.round(value * 100) / 100

function readValues<const T extends readonly string[]>(
  formData: FormData,
  fields: T
) {
  return Object.fromEntries(
    fields.map((key) => {
      const value = formData.get(key)
      return [key, typeof value === "string" ? value : ""]
    })
  ) as Record<T[number], string>
}

// Deuda del espacio Personal del usuario, con su saldo actual
async function findDebt(debtId: string) {
  const workspace = await getPersonalWorkspace()
  return loadDebt(await createClient(), workspace.id, debtId)
}

// Entrada del espacio Personal del usuario, con su deuda
async function findEntry(entryId: string) {
  const workspace = await getPersonalWorkspace()
  return loadEntry(await createClient(), workspace.id, entryId)
}

// Valida con el esquema del tipo (y, en una cuenta por cobrar, del tipo de
// cobro) más la cuenta habitual
function readDebtForm(
  formData: FormData,
  kind: DebtKind,
  schedule: ReceivableSchedule | null
) {
  const values = {
    ...readValues(formData, [...debtFieldsFor(kind, schedule), "account_id"]),
    kind,
    ...(schedule ? { schedule } : {})
  }
  return { values, parsed: parseDebtInput(kind, schedule, values) }
}

export async function createDebt(
  _prevState: DebtFormState,
  formData: FormData
): Promise<DebtFormState> {
  const kind = kindSchema.safeParse(formData.get("kind"))

  if (!kind.success) {
    return { fieldErrors: { kind: ["Elige el tipo de deuda"] } }
  }

  // El tipo de cobro solo aplica a cuentas por cobrar; sin él, cobro único
  let schedule: ReceivableSchedule | null = null
  if (kind.data === "receivable") {
    const parsedSchedule = receivableScheduleSchema.safeParse(
      formData.get("schedule") ?? "once"
    )
    if (!parsedSchedule.success) {
      return { fieldErrors: { schedule: ["Elige el tipo de cobro"] } }
    }
    schedule = parsedSchedule.data
  }

  const { values, parsed } = readDebtForm(formData, kind.data, schedule)

  if (!parsed.success) {
    return { fieldErrors: parsed.fieldErrors, values }
  }

  const workspace = await getPersonalWorkspace()
  const result = await createDebtRecord(
    await createClient(),
    workspace,
    kind.data,
    parsed.data
  )

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
  }

  revalidatePersonalPages()
  return { ok: true }
}

export async function updateDebt(
  _prevState: DebtFormState,
  formData: FormData
): Promise<DebtFormState> {
  const id = idSchema.safeParse(formData.get("id"))

  if (!id.success) {
    return { error: DEBT_NOT_FOUND }
  }

  const debt = await findDebt(id.data)
  if (!debt) {
    return { error: DEBT_NOT_FOUND }
  }

  // El tipo y el tipo de cobro no cambian: se valida con el esquema de los
  // guardados
  const { values, parsed } = readDebtForm(formData, debt.kind, debt.schedule)

  if (!parsed.success) {
    return { fieldErrors: parsed.fieldErrors, values }
  }

  const result = await updateDebtRecord(await createClient(), debt, parsed.data)

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
  }

  revalidatePersonalPages()
  return { ok: true }
}

// Cambia el estado solo si la deuda está en uno de los estados `from`
async function transitionDebt(
  id: string,
  from: DebtStatus[],
  to: DebtStatus
): Promise<DebtActionResult> {
  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("debts")
    .update({
      status: to,
      closed_at: to === "paid" ? new Date().toISOString() : null
    })
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .in("status", from)
    .select("id")

  if (error) {
    return { error: "No se pudo actualizar la deuda. Intenta de nuevo" }
  }
  if (data.length === 0) {
    return { error: DEBT_NOT_FOUND }
  }

  revalidatePersonalPages()
  return {}
}

export async function markDebtPaid(id: string): Promise<DebtActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: DEBT_NOT_FOUND }
  }

  const debt = await findDebt(parsedId.data)
  if (!debt) {
    return { error: DEBT_NOT_FOUND }
  }
  if (debt.balance > 0) {
    return { error: HAS_BALANCE }
  }
  // Mensual indefinida: sin saldo total, sigue activa hasta archivarla
  if (debt.openEnded) {
    return { error: "Un cobro mensual sin número de cuotas se archiva" }
  }

  return transitionDebt(debt.id, ["active"], "paid")
}

export async function archiveDebt(id: string): Promise<DebtActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: DEBT_NOT_FOUND }
  }
  return transitionDebt(parsedId.data, ["active", "paid"], "archived")
}

export async function reactivateDebt(id: string): Promise<DebtActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: DEBT_NOT_FOUND }
  }
  return transitionDebt(parsedId.data, ["paid", "archived"], "active")
}

function parsePayment(formData: FormData) {
  const values = readValues(formData, PAYMENT_FIELDS)
  const parsed = paymentSchema.safeParse(values)
  return { values, parsed }
}

// Pago de tarjeta o préstamo, o abono de cuenta por cobrar. El movimiento,
// si se pide, se crea en la misma transacción (record_debt_payment).
export async function recordPayment(
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const { values, parsed } = parsePayment(formData)
  const debtId = idSchema.safeParse(formData.get("debt_id"))

  if (!debtId.success) {
    return { error: DEBT_NOT_FOUND, values }
  }
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const debt = await findDebt(debtId.data)
  if (!debt) {
    return { error: DEBT_NOT_FOUND, values }
  }

  const result = await recordDebtPaymentRecord(
    await createClient(),
    debt,
    parsed.data
  )
  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
  }

  revalidatePersonalPages()
  return { ok: true }
}

// Cobro de una cuenta por cobrar (SPEC 39): Abono o Pago completo en una de
// cobro único, Una cuota o Varios meses en una mensual. Lo usan el tab Me
// deben del diálogo de movimiento y el Sheet de la cuenta por cobrar.
export async function collectReceivable(
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const values = readValues(formData, COLLECT_FIELDS)
  const debtId = idSchema.safeParse(formData.get("debt_id"))

  if (!debtId.success) {
    return { fieldErrors: { debt_id: [RECEIVABLE_NOT_FOUND] }, values }
  }

  const parsed = receivableCollectSchema.safeParse(values)
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const debt = await findDebt(debtId.data)
  if (!debt) {
    return { fieldErrors: { debt_id: [RECEIVABLE_NOT_FOUND] }, values }
  }

  const result = await recordReceivableCollection(
    await createClient(),
    debt,
    parsed.data
  )
  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
  }

  revalidatePersonalPages()
  return { ok: true }
}

// Avance de tarjeta: sube el saldo de la deuda (record_card_advance). Con
// cuenta, crea además un ingreso en ella con la categoría "Avance de tarjeta",
// enlazado a la entrada (SPEC 36). No lleva traspaso.
export async function recordAdvance(
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const values = readValues(formData, ADVANCE_FIELDS)
  const parsed = advanceSchema.safeParse(values)
  const debtId = idSchema.safeParse(formData.get("debt_id"))

  if (!debtId.success) {
    return { error: DEBT_NOT_FOUND, values }
  }
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const debt = await findDebt(debtId.data)
  if (!debt) {
    return { error: DEBT_NOT_FOUND, values }
  }
  if (debt.status !== "active") {
    return { error: DEBT_NOT_ACTIVE, values }
  }
  if (debt.kind !== "credit_card") {
    return { error: ADVANCE_ONLY_CARD, values }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("record_card_advance", {
    p_debt_id: debt.id,
    p_amount: parsed.data.amount,
    p_occurred_on: parsed.data.occurred_on,
    p_occurred_time: parsed.data.occurred_time ?? undefined,
    // Los tipos generados no marcan el parámetro como nullable
    p_note: parsed.data.note as string,
    p_account_id: parsed.data.account_id ?? undefined,
    p_installments: parsed.data.installments ?? undefined
  })

  if (error) {
    return {
      ...debtPgError(error, "amount", NEGATIVE_BALANCE, ENTRY_DEFAULT_ERROR),
      values
    }
  }

  revalidatePersonalPages()
  return { ok: true }
}

// Edita cualquier movimiento de una deuda como si se registrara de nuevo
// (SPEC 42, parte 3): tipo, monto, fecha, hora, nota, cuenta, movimiento,
// abono extra y cuotas. Todo pasa en update_debt_entry.
export async function updateDebtEntry(
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const values = readValues(formData, ENTRY_EDIT_FIELDS)
  const id = idSchema.safeParse(formData.get("id"))

  if (!id.success) {
    return { error: ENTRY_NOT_FOUND, values }
  }

  const parsed = debtEntryEditSchema.safeParse(values)
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const entry = await findEntry(id.data)
  if (!entry) {
    return { error: ENTRY_NOT_FOUND, values }
  }

  const result = await updateDebtEntryRecord(
    await createClient(),
    entry,
    parsed.data
  )
  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
  }

  revalidatePersonalPages()
  return { ok: true }
}

/** Lo que el editor de un movimiento necesita de su deuda */
export type EntryEditorDebt = Pick<
  LoadedEntry["debt"],
  "id" | "kind" | "name" | "status" | "schedule" | "balance"
>

// Movimiento y deuda para el editor (SPEC 42, parte 3). Lo usa Movimientos,
// que no tiene el abono completo; el Sheet de la deuda ya los tiene.
export async function loadDebtEntryEditor(
  entryId: string
): Promise<{ entry: DebtEntry; debt: EntryEditorDebt } | { error: string }> {
  const id = idSchema.safeParse(entryId)
  if (!id.success) {
    return { error: ENTRY_NOT_FOUND }
  }

  try {
    const [loaded, entry] = await Promise.all([
      findEntry(id.data),
      getDebtEntry(id.data)
    ])
    if (!loaded || !entry) {
      return { error: ENTRY_NOT_FOUND }
    }
    const { id: debtId, kind, name, status, schedule, balance } = loaded.debt
    return {
      entry,
      debt: { id: debtId, kind, name, status, schedule, balance }
    }
  } catch {
    return { error: "No se pudo cargar el movimiento. Intenta de nuevo" }
  }
}

// Movimientos ya registrados que pueden ser el de este pago, cobro o avance
// (SPEC 42): sueltos, del mismo monto, a ±7 días de la fecha. Vacío si el
// tipo no lleva movimiento o la deuda no está activa.
export async function listLinkableTransactions(
  entryId: string,
  type: EntryType,
  amount: number,
  occurredOn: string
): Promise<LinkableTransaction[]> {
  const id = idSchema.safeParse(entryId)
  const date = z.iso.date().safeParse(occurredOn)
  if (!id.success || !date.success || !(amount > 0)) {
    return []
  }

  const entry = await findEntry(id.data)
  if (!entry || entry.debt.status !== "active") {
    return []
  }

  const kind = entryKindOf(type)
  // Pago de tarjeta y préstamo: gasto. Cobro de Me deben y avance: ingreso
  const txType =
    type === "advance" ||
    (kind === "payment" && entry.debt.kind === "receivable")
      ? "income"
      : kind === "payment"
        ? "expense"
        : null
  if (!txType) {
    return []
  }
  return findLinkableTransactions(entry.debt_id, amount, date.data, txType)
}

// Borra un pago, un avance, una cuota o un ajuste. Si el pago o el avance
// tiene movimiento, el trigger también lo borra.
export async function deleteEntry(id: string): Promise<DebtActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: ENTRY_NOT_FOUND }
  }

  const entry = await findEntry(parsedId.data)
  if (!entry) {
    return { error: ENTRY_NOT_FOUND }
  }

  const result = await deleteEntryRecord(await createClient(), entry)
  if (!result.ok) {
    return { error: result.error }
  }

  revalidatePersonalPages()
  return {}
}

// "Actualizar saldo": crea un ajuste por la diferencia entre el saldo real y
// el actual. No crea movimiento.
export async function adjustBalance(
  _prevState: AdjustBalanceFormState,
  formData: FormData
): Promise<AdjustBalanceFormState> {
  const values = readValues(formData, ADJUST_FIELDS)
  const parsed = adjustBalanceSchema.safeParse(values)
  const debtId = idSchema.safeParse(formData.get("debt_id"))

  if (!debtId.success) {
    return { error: DEBT_NOT_FOUND, values }
  }
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const debt = await findDebt(debtId.data)
  if (!debt) {
    return { error: DEBT_NOT_FOUND, values }
  }
  if (debt.status !== "active") {
    return { error: DEBT_NOT_ACTIVE, values }
  }

  const amount = roundCents(parsed.data.balance - debt.balance)
  if (amount === 0) {
    return { fieldErrors: { balance: [SAME_BALANCE] }, values }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("debt_entries").insert({
    workspace_id: debt.workspace_id,
    debt_id: debt.id,
    kind: "adjustment",
    amount,
    occurred_on: parsed.data.occurred_on,
    occurred_time: parsed.data.occurred_time,
    note: parsed.data.note
  })

  if (error) {
    return {
      ...debtPgError(error, "balance", NEGATIVE_BALANCE, ENTRY_DEFAULT_ERROR),
      values
    }
  }

  revalidatePersonalPages()
  return { ok: true }
}
