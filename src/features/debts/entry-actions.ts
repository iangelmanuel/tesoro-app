"use server"

import { z } from "zod"
import { revalidatePersonalPages } from "@/features/workspaces/revalidate"
import { readFormValues } from "@/libs/form-data"
import { createClient } from "@/libs/supabase/server"
import { nextPayment } from "./calculations"
import type { LoadedEntry } from "./debt-loader"
import { findDebt, findEntry, idSchema } from "./debt-lookup"
import {
  adjustBalanceRecord,
  recordDebtChargeRecord
} from "./entry-adjustment-service"
import { recordCardAdvanceRecord } from "./entry-advance-service"
import { recordDebtPaymentRecord } from "./entry-payment-service"
import {
  adjustBalanceSchema,
  advanceSchema,
  debtChargeSchema,
  debtEntryEditSchema,
  paymentSchema
} from "./entry-schemas"
import {
  deleteEntryRecord,
  moveDebtEntryRecord,
  updateDebtEntryRecord
} from "./entry-service"
import { type EntryType, entryKindOf } from "./entry-types"
import { DEBT_NOT_FOUND, ENTRY_NOT_FOUND } from "./errors"
import {
  type DebtEntry,
  type LinkableTransaction,
  findLinkableTransactions,
  getDebtEntry,
  getDebts
} from "./queries"
import type {
  AdjustBalanceFormState,
  DebtActionResult,
  PaymentFormState
} from "./types"

// Movimientos de una deuda: pago, avance, cuota de manejo, ajuste y
// actualizar saldo; editarlos, borrarlos y reordenarlos

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

const CHARGE_FIELDS = [
  "type",
  "amount",
  "direction",
  "occurred_on",
  "occurred_time",
  "note"
] as const

// Pago de tarjeta o préstamo, o abono de cuenta por cobrar. El movimiento,
// si se pide, se crea en la misma transacción (record_debt_payment).
export async function recordPayment(
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const values = readFormValues(formData, PAYMENT_FIELDS)
  const parsed = paymentSchema.safeParse(values)
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

// Avance de tarjeta: sube el saldo de la deuda (record_card_advance). Con
// cuenta, crea además un ingreso en ella con la categoría "Avance de tarjeta",
// enlazado a la entrada (SPEC 36). No lleva traspaso.
export async function recordAdvance(
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const values = readFormValues(formData, ADVANCE_FIELDS)
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

  // "Avance" en Registrar movimiento (SPEC 46): sin cuenta sería una compra
  const result = await recordCardAdvanceRecord(
    await createClient(),
    debt,
    parsed.data,
    formData.get("type") === "advance"
  )
  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
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
  const values = readFormValues(formData, ENTRY_EDIT_FIELDS)
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
> & {
  /**
   * La cuota del ciclo actual ya está cubierta (`nextPayment`). Solo llega
   * con `{ cycle: true }` (Duplicar, SPEC 49)
   */
  cycle_covered?: boolean
}

// Movimiento y deuda para el editor (SPEC 42, parte 3) y para Duplicar (SPEC
// 49). Lo usa Movimientos, que no tiene el abono completo; el Sheet de la
// deuda ya los tiene.
export async function loadDebtEntryEditor(
  entryId: string,
  options: { cycle?: boolean } = {}
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
    const debt: EntryEditorDebt = {
      id: debtId,
      kind,
      name,
      status,
      schedule,
      balance
    }
    if (options.cycle === true) {
      // El ciclo sale de debt_overview, la misma fuente del Sheet
      const overview = (await getDebts(loaded.debt.workspace_id)).find(
        (option) => option.id === debtId
      )
      debt.cycle_covered =
        overview !== undefined && nextPayment(overview)?.status === "paid"
    }
    return { entry, debt }
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
  const values = readFormValues(formData, ADJUST_FIELDS)
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

  const result = await adjustBalanceRecord(
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

// Cuota de manejo o ajuste nuevo desde "Registrar movimiento" (SPEC 46):
// suben o bajan el saldo sin tocar cuentas
export async function recordDebtCharge(
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const values = readFormValues(formData, CHARGE_FIELDS)
  const parsed = debtChargeSchema.safeParse(values)
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

  const result = await recordDebtChargeRecord(
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

// Reordena el historial de una deuda dentro del mismo día (SPEC 45): la
// fila toma el lugar de la destino. RLS y la RPC validan dueño y espacio
export async function moveDebtEntry(
  id: string,
  targetId: string
): Promise<DebtActionResult> {
  const parsedId = idSchema.safeParse(id)
  const parsedTarget = idSchema.safeParse(targetId)

  if (!parsedId.success || !parsedTarget.success) {
    return { error: ENTRY_NOT_FOUND }
  }

  const result = await moveDebtEntryRecord(
    await createClient(),
    parsedId.data,
    parsedTarget.data
  )
  if (!result.ok) {
    return { error: result.error }
  }

  revalidatePersonalPages()
  return {}
}
