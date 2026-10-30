"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/libs/revalidate"
import { createClient } from "@/libs/supabase/server"
import type { DebtStatus } from "./calculations"
import {
  DEBT_KINDS,
  DEBT_SCHEMAS,
  type DebtKind,
  adjustBalanceSchema,
  paymentSchema
} from "./schemas"
import type {
  AdjustBalanceFormState,
  DebtActionResult,
  DebtFormState,
  PaymentFormState
} from "./types"

const DEBT_NOT_FOUND = "No se encontró la deuda"
const ENTRY_NOT_FOUND = "No se encontró el pago"
const DEBT_DEFAULT_ERROR = "No se pudo guardar la deuda. Intenta de nuevo"
const ENTRY_DEFAULT_ERROR = "No se pudo guardar el pago. Intenta de nuevo"
const DEBT_NOT_ACTIVE = "Reactiva la deuda para registrar pagos"
const OVER_PAYMENT = "El pago supera el saldo"
const NEGATIVE_BALANCE = "El saldo de la deuda no puede quedar negativo"
const HAS_BALANCE = "La deuda aún tiene saldo"
const SAME_BALANCE = "El saldo ya es ese"
const FUTURE_DATE = "La fecha no puede ser futura"
const CARD_TRANSACTION = "Un pago de tarjeta no crea un movimiento"
const ARCHIVED_ACCOUNT = "La cuenta está archivada"

const DEBT_FIELDS: Record<DebtKind, readonly string[]> = {
  credit_card: [
    "name",
    "counterparty",
    "opening_balance",
    "credit_limit",
    "due_day",
    "interest_rate",
    "rate_type",
    "min_payment",
    "closing_day"
  ],
  loan: [
    "name",
    "counterparty",
    "opening_balance",
    "installment",
    "interest_rate",
    "rate_type",
    "due_day",
    "original_amount",
    "term_months"
  ],
  receivable: ["name", "counterparty", "opening_balance", "expected_on"]
}

const PAYMENT_FIELDS = [
  "amount",
  "occurred_on",
  "note",
  "create_transaction",
  "account_id"
] as const

const ADJUST_FIELDS = ["balance", "occurred_on", "note"] as const

const idSchema = z.uuid()
const kindSchema = z.enum(DEBT_KINDS)

// Los montos se suman en JS: se redondean a centavos para no arrastrar error
// de punto flotante
const roundCents = (value: number) => Math.round(value * 100) / 100

// Los triggers de debts y debt_entries lanzan check_violation con su mensaje.
// `balanceField` es el campo al que se asigna el error de saldo negativo.
function debtPgError(
  error: PostgrestError,
  balanceField: string,
  balanceMessage: string,
  defaultError: string
): DebtFormState {
  if (error.message.includes(NEGATIVE_BALANCE)) {
    return { fieldErrors: { [balanceField]: [balanceMessage] } }
  }
  if (error.message.includes(DEBT_NOT_ACTIVE)) {
    return { error: DEBT_NOT_ACTIVE }
  }
  if (error.message.includes(FUTURE_DATE)) {
    return { fieldErrors: { occurred_on: [FUTURE_DATE] } }
  }
  if (error.message.includes(CARD_TRANSACTION)) {
    return { error: CARD_TRANSACTION }
  }
  // Cuenta del movimiento de un pago: archivada o de otro espacio
  if (error.message.includes(ARCHIVED_ACCOUNT)) {
    return { fieldErrors: { account_id: [ARCHIVED_ACCOUNT] } }
  }
  if (error.code === "23503" && error.message.includes("account_id")) {
    return { fieldErrors: { account_id: ["Elige una cuenta válida"] } }
  }
  if (error.code === "23503") {
    return { error: DEBT_NOT_FOUND }
  }
  if (error.code === "42501") {
    return { error: "No tienes permiso para modificar esta deuda" }
  }
  return { error: defaultError }
}

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
  const supabase = await createClient()
  const { data } = await supabase
    .from("debts")
    .select(
      "id, workspace_id, kind, status, opening_balance, entries:debt_entries (kind, amount)"
    )
    .eq("id", debtId)
    .eq("workspace_id", workspace.id)
    .maybeSingle()

  if (!data) {
    return null
  }

  // saldo = saldo inicial − pagos + ajustes
  const balance = data.entries.reduce(
    (sum, entry) =>
      entry.kind === "payment"
        ? sum - Number(entry.amount)
        : sum + Number(entry.amount),
    Number(data.opening_balance)
  )

  return { ...data, balance: roundCents(balance) }
}

// Entrada del espacio Personal del usuario, con su deuda
async function findEntry(entryId: string) {
  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { data } = await supabase
    .from("debt_entries")
    .select("id, debt_id, kind, amount")
    .eq("id", entryId)
    .eq("workspace_id", workspace.id)
    .maybeSingle()

  if (!data) {
    return null
  }

  const debt = await findDebt(data.debt_id)
  return debt ? { ...data, amount: Number(data.amount), debt } : null
}

// Valida con el esquema del tipo. Los errores se aplanan aquí porque cada
// tipo tiene su propio esquema.
function readDebtForm(formData: FormData, kind: DebtKind) {
  const values = { ...readValues(formData, DEBT_FIELDS[kind]), kind }
  const result = DEBT_SCHEMAS[kind].safeParse(values)
  const parsed = result.success
    ? ({ success: true, data: result.data } as const)
    : ({
        success: false,
        fieldErrors: z.flattenError(result.error as z.ZodError).fieldErrors
      } as const)
  return { values, parsed }
}

export async function createDebt(
  _prevState: DebtFormState,
  formData: FormData
): Promise<DebtFormState> {
  const kind = kindSchema.safeParse(formData.get("kind"))

  if (!kind.success) {
    return { fieldErrors: { kind: ["Elige el tipo de deuda"] } }
  }

  const { values, parsed } = readDebtForm(formData, kind.data)

  if (!parsed.success) {
    return { fieldErrors: parsed.fieldErrors, values }
  }

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { error } = await supabase.from("debts").insert({
    ...parsed.data,
    kind: kind.data,
    workspace_id: workspace.id
  })

  if (error) {
    return {
      ...debtPgError(
        error,
        "opening_balance",
        NEGATIVE_BALANCE,
        DEBT_DEFAULT_ERROR
      ),
      values
    }
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

  // El tipo no cambia: se valida con el esquema del tipo guardado
  const { values, parsed } = readDebtForm(formData, debt.kind)

  if (!parsed.success) {
    return { fieldErrors: parsed.fieldErrors, values }
  }

  // El saldo cambia lo mismo que el saldo inicial
  const newBalance =
    debt.balance - Number(debt.opening_balance) + parsed.data.opening_balance
  if (newBalance < 0) {
    return {
      fieldErrors: {
        opening_balance: ["Con este saldo inicial la deuda queda en negativo"]
      },
      values
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("debts")
    .update(parsed.data)
    .eq("id", debt.id)
    .eq("workspace_id", debt.workspace_id)
    .select("id")

  if (error) {
    return {
      ...debtPgError(
        error,
        "opening_balance",
        "Con este saldo inicial la deuda queda en negativo",
        DEBT_DEFAULT_ERROR
      ),
      values
    }
  }
  if (data.length === 0) {
    return { error: DEBT_NOT_FOUND, values }
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
  if (debt.status !== "active") {
    return { error: DEBT_NOT_ACTIVE, values }
  }
  if (debt.kind === "credit_card" && parsed.data.create_transaction) {
    return { error: CARD_TRANSACTION, values }
  }
  if (parsed.data.amount > debt.balance) {
    return { fieldErrors: { amount: [OVER_PAYMENT] }, values }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("record_debt_payment", {
    p_debt_id: debt.id,
    p_amount: parsed.data.amount,
    p_occurred_on: parsed.data.occurred_on,
    // Los tipos generados no marcan el parámetro como nullable
    p_note: parsed.data.note as string,
    p_create_transaction: parsed.data.create_transaction,
    // Solo cuenta si se crea el movimiento
    p_account_id: parsed.data.create_transaction
      ? (parsed.data.account_id ?? undefined)
      : undefined
  })

  if (error) {
    return {
      ...debtPgError(error, "amount", OVER_PAYMENT, ENTRY_DEFAULT_ERROR),
      values
    }
  }

  revalidatePersonalPages()
  return { ok: true }
}

// Edita un pago o un ajuste. En un pago se cambian monto, fecha y nota (el
// trigger copia monto y fecha a su movimiento). En un ajuste, el formulario
// pide el saldo real como en "Actualizar saldo" y el ajuste se recalcula
// sobre el saldo sin él.
export async function updateEntry(
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const id = idSchema.safeParse(formData.get("id"))

  if (!id.success) {
    return { error: ENTRY_NOT_FOUND }
  }

  const entry = await findEntry(id.data)
  if (!entry) {
    return { error: ENTRY_NOT_FOUND }
  }
  if (entry.debt.status !== "active") {
    return { error: DEBT_NOT_ACTIVE }
  }

  let update: { amount: number; occurred_on: string; note: string | null }
  let values: Record<string, string>

  if (entry.kind === "payment") {
    const payment = parsePayment(formData)
    values = payment.values

    if (!payment.parsed.success) {
      return {
        fieldErrors: z.flattenError(payment.parsed.error).fieldErrors,
        values
      }
    }
    // El saldo sin este pago debe cubrir el monto nuevo
    if (payment.parsed.data.amount > entry.debt.balance + entry.amount) {
      return { fieldErrors: { amount: [OVER_PAYMENT] }, values }
    }

    const { amount, occurred_on, note } = payment.parsed.data
    update = { amount, occurred_on, note }
  } else {
    values = readValues(formData, ADJUST_FIELDS)
    const parsed = adjustBalanceSchema.safeParse(values)

    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
    }

    const amount = roundCents(
      parsed.data.balance - (entry.debt.balance - entry.amount)
    )
    if (amount === 0) {
      return {
        fieldErrors: {
          balance: ["Sin este ajuste el saldo ya es ese. Elimínalo"]
        },
        values
      }
    }

    update = {
      amount,
      occurred_on: parsed.data.occurred_on,
      note: parsed.data.note
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("debt_entries")
    .update(update)
    .eq("id", entry.id)
    .select("id")

  if (error) {
    return {
      ...debtPgError(
        error,
        entry.kind === "payment" ? "amount" : "balance",
        entry.kind === "payment" ? OVER_PAYMENT : NEGATIVE_BALANCE,
        ENTRY_DEFAULT_ERROR
      ),
      values
    }
  }
  if (data.length === 0) {
    return { error: ENTRY_NOT_FOUND, values }
  }

  revalidatePersonalPages()
  return { ok: true }
}

// Borra un pago o un ajuste. Si el pago tiene movimiento, el trigger también
// lo borra.
export async function deleteEntry(id: string): Promise<DebtActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: ENTRY_NOT_FOUND }
  }

  const entry = await findEntry(parsedId.data)
  if (!entry) {
    return { error: ENTRY_NOT_FOUND }
  }
  if (entry.debt.status !== "active") {
    return { error: DEBT_NOT_ACTIVE }
  }
  // Borrar un ajuste que subió el saldo lo baja
  if (entry.kind === "adjustment" && entry.debt.balance - entry.amount < 0) {
    return { error: NEGATIVE_BALANCE }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("debt_entries")
    .delete()
    .eq("id", entry.id)
    .select("id")

  if (error) {
    const result = debtPgError(
      error,
      "amount",
      NEGATIVE_BALANCE,
      "No se pudo eliminar. Intenta de nuevo"
    )
    return { error: result.error ?? result.fieldErrors?.amount?.[0] }
  }
  if (data.length === 0) {
    return { error: ENTRY_NOT_FOUND }
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
