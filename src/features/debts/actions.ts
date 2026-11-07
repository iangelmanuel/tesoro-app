"use server"

import { z } from "zod"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { shiftMonth, todayISO } from "@/libs/dates"
import { revalidatePersonalPages } from "@/libs/revalidate"
import { createClient } from "@/libs/supabase/server"
import type { DebtStatus } from "./calculations"
import { deleteEntryRecord, loadDebt, loadEntry } from "./entry-service"
import {
  ADVANCE_ONLY_CARD,
  CARD_TRANSACTION,
  DEBT_NOT_ACTIVE,
  DEBT_NOT_FOUND,
  ENTRY_NOT_FOUND,
  INSTALLMENT_REQUIRED,
  NEGATIVE_BALANCE,
  OVER_PAYMENT,
  debtPgError
} from "./errors"
import { lastPeriodOn, periodOf } from "./receivable-schedule"
import {
  DEBT_KINDS,
  DEBT_SCHEMAS,
  type DebtKind,
  type ReceivableSchedule,
  adjustBalanceSchema,
  advanceSchema,
  monthlyReceivableSchema,
  paymentSchema,
  receivableScheduleSchema
} from "./schemas"
import type {
  AdjustBalanceFormState,
  DebtActionResult,
  DebtFormState,
  PaymentFormState
} from "./types"

const DEBT_DEFAULT_ERROR = "No se pudo guardar la deuda. Intenta de nuevo"
const ENTRY_DEFAULT_ERROR = "No se pudo guardar el pago. Intenta de nuevo"
const HAS_BALANCE = "La deuda aún tiene saldo"
const SAME_BALANCE = "El saldo ya es ese"
const RECEIVABLE_TRANSFER = "Un abono no admite traspaso"
const RECEIVABLE_EXTRA = "Una cuenta por cobrar no tiene abonos extra"
const ENTRIES_OUT_OF_RANGE =
  "Hay cobros de cuotas fuera de estas fechas. Elimínalos primero"

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
    "closing_day",
    "fee_amount",
    "fee_day"
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

// Cuenta por cobrar mensual (SPEC 28): el saldo inicial se calcula
const MONTHLY_RECEIVABLE_FIELDS = [
  "name",
  "counterparty",
  "installment",
  "due_day",
  "starts_on",
  "term_months"
] as const

const PAYMENT_FIELDS = [
  "amount",
  "occurred_on",
  "occurred_time",
  "note",
  "create_transaction",
  "is_extra_payment",
  "period_on",
  "account_id",
  "transfer_from",
  "transfer_amount"
] as const

const ADVANCE_FIELDS = [
  "amount",
  "occurred_on",
  "occurred_time",
  "note",
  "account_id"
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
// cobro). Los errores se aplanan aquí porque cada tipo tiene su propio
// esquema.
function readDebtForm(
  formData: FormData,
  kind: DebtKind,
  schedule: ReceivableSchedule | null
) {
  const monthly = kind === "receivable" && schedule === "monthly"
  const values = {
    ...readValues(
      formData,
      monthly ? MONTHLY_RECEIVABLE_FIELDS : DEBT_FIELDS[kind]
    ),
    kind,
    ...(schedule ? { schedule } : {})
  }
  const result = (
    monthly ? monthlyReceivableSchema : DEBT_SCHEMAS[kind]
  ).safeParse(values)
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

  // El tipo y el tipo de cobro no cambian: se valida con el esquema de los
  // guardados
  const { values, parsed } = readDebtForm(formData, debt.kind, debt.schedule)

  if (!parsed.success) {
    return { fieldErrors: parsed.fieldErrors, values }
  }

  // Cobro mensual: los cobros ya hechos deben seguir dentro de las cuotas
  if ("starts_on" in parsed.data) {
    const first = periodOf(parsed.data.starts_on)
    const last = lastPeriodOn(parsed.data)
    const outside = debt.entries.some(
      (entry) =>
        entry.period_on !== null &&
        (entry.period_on < first || (last !== null && entry.period_on > last))
    )
    if (outside) {
      return { fieldErrors: { starts_on: [ENTRIES_OUT_OF_RANGE] }, values }
    }
  }

  // El saldo cambia lo mismo que el saldo inicial. Una mensual indefinida no
  // tiene saldo total. En una mensual con cuotas el saldo inicial sale de las
  // cuotas, así que el error va en ellas.
  const monthlyForm = "starts_on" in parsed.data
  const newBalance =
    debt.balance - Number(debt.opening_balance) + parsed.data.opening_balance
  if (newBalance < 0 && !(monthlyForm && parsed.data.term_months === null)) {
    return {
      fieldErrors: {
        [monthlyForm ? "term_months" : "opening_balance"]: [
          "Con este saldo inicial la deuda queda en negativo"
        ]
      },
      values
    }
  }

  const supabase = await createClient()

  // Mensual indefinida con un valor nuevo (SPEC 29): los meses ya corridos
  // conservan el valor anterior, así sus abonos no quedan cortos
  if (monthlyForm && debt.openEnded && debt.installment !== null) {
    const previousValue = Number(debt.installment)
    const historyError = await keepPreviousInstallment(
      debt.id,
      debt.workspace_id,
      parsed.data.starts_on,
      previousValue,
      parsed.data.installment
    )
    if (historyError) {
      return { error: DEBT_DEFAULT_ERROR, values }
    }
  }

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

/**
 * Al cambiar el valor de una mensual indefinida, guarda el anterior hasta el
 * mes pasado (SPEC 29). No hace nada si el valor no cambia, si el cobro
 * empieza este mes o después, o si el historial ya cubre el mes pasado.
 * Devuelve true si falló.
 */
async function keepPreviousInstallment(
  debtId: string,
  workspaceId: string,
  startsOn: string,
  previousValue: number,
  newValue: number
) {
  const lastMonth = `${shiftMonth(todayISO().slice(0, 7), -1)}-01`
  if (previousValue === newValue || periodOf(startsOn) > lastMonth) {
    return false
  }

  const supabase = await createClient()
  const { data: covered, error: readError } = await supabase
    .from("receivable_installment_history")
    .select("id")
    .eq("debt_id", debtId)
    .gte("through_period", lastMonth)
    .limit(1)

  if (readError) {
    return true
  }
  if (covered.length > 0) {
    return false
  }

  const { error } = await supabase
    .from("receivable_installment_history")
    .insert({
      workspace_id: workspaceId,
      debt_id: debtId,
      through_period: lastMonth,
      amount: previousValue
    })
  return error !== null
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
  if (debt.status !== "active") {
    return { error: DEBT_NOT_ACTIVE, values }
  }
  if (debt.kind === "credit_card" && parsed.data.create_transaction) {
    return { error: CARD_TRANSACTION, values }
  }
  if (!debt.openEnded && parsed.data.amount > debt.balance) {
    return { fieldErrors: { amount: [OVER_PAYMENT] }, values }
  }

  // Cuota del cobro mensual (SPEC 28): obligatoria. Admite varios abonos
  // hasta cubrir su valor (SPEC 29). En otras deudas no aplica.
  const monthly = debt.kind === "receivable" && debt.schedule === "monthly"
  const periodOn = monthly ? parsed.data.period_on : null
  if (monthly && periodOn === null) {
    return { fieldErrors: { period_on: [INSTALLMENT_REQUIRED] }, values }
  }
  if (debt.kind === "receivable" && parsed.data.transfer_from) {
    return { fieldErrors: { transfer_from: [RECEIVABLE_TRANSFER] }, values }
  }
  if (debt.kind === "receivable" && parsed.data.is_extra_payment) {
    return { error: RECEIVABLE_EXTRA, values }
  }

  // Cuenta del pago: la de la entrada en una tarjeta y la del movimiento en
  // un préstamo o una cuenta por cobrar. Sin movimiento no aplica.
  const accountId =
    debt.kind === "credit_card" || parsed.data.create_transaction
      ? (parsed.data.account_id ?? undefined)
      : undefined
  const hasTransfer = accountId !== undefined && parsed.data.transfer_from

  const supabase = await createClient()
  const { error } = await supabase.rpc("record_debt_payment", {
    p_debt_id: debt.id,
    p_amount: parsed.data.amount,
    p_occurred_on: parsed.data.occurred_on,
    p_occurred_time: parsed.data.occurred_time ?? undefined,
    // Los tipos generados no marcan el parámetro como nullable
    p_note: parsed.data.note as string,
    p_create_transaction: parsed.data.create_transaction,
    p_account_id: accountId,
    p_transfer_from: hasTransfer
      ? (parsed.data.transfer_from ?? undefined)
      : undefined,
    p_transfer_amount: hasTransfer
      ? (parsed.data.transfer_amount ?? undefined)
      : undefined,
    p_is_extra_payment: parsed.data.is_extra_payment,
    p_period_on: periodOn ?? undefined
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

// Avance de tarjeta: sube el saldo de la deuda y, con cuenta, el de la cuenta
// (record_card_advance). No crea movimiento ni lleva traspaso.
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
    p_account_id: parsed.data.account_id ?? undefined
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

// Edita un pago, un avance, una cuota de manejo o un ajuste. En un pago se
// cambian monto, fecha, nota y si es un abono extra (el trigger copia monto y
// fecha a su movimiento). En un ajuste, el formulario
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

  let update: {
    amount: number
    occurred_on: string
    occurred_time: string | null
    note: string | null
    is_extra_payment?: boolean
  }
  let values: Record<string, string>

  // La cuota de manejo (SPEC 17) cambia monto, fecha y nota como un avance:
  // sube el saldo y no lleva cuenta
  if (entry.kind === "advance" || entry.kind === "fee") {
    values = readValues(formData, ADVANCE_FIELDS)
    const parsed = advanceSchema.safeParse(values)

    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
    }
    // Bajar un avance o una cuota baja el saldo: no puede quedar negativo
    if (entry.debt.balance - entry.amount + parsed.data.amount < 0) {
      return { fieldErrors: { amount: [NEGATIVE_BALANCE] }, values }
    }

    const { amount, occurred_on, occurred_time, note } = parsed.data
    update = { amount, occurred_on, occurred_time, note }
  } else if (entry.kind === "payment") {
    const payment = parsePayment(formData)
    values = payment.values

    if (!payment.parsed.success) {
      return {
        fieldErrors: z.flattenError(payment.parsed.error).fieldErrors,
        values
      }
    }
    // El saldo sin este pago debe cubrir el monto nuevo (salvo en una
    // mensual indefinida, sin saldo total)
    if (
      !entry.debt.openEnded &&
      payment.parsed.data.amount > entry.debt.balance + entry.amount
    ) {
      return { fieldErrors: { amount: [OVER_PAYMENT] }, values }
    }

    const { amount, occurred_on, occurred_time, note, is_extra_payment } =
      payment.parsed.data
    if (entry.debt.kind === "receivable" && is_extra_payment) {
      return { error: RECEIVABLE_EXTRA, values }
    }
    update = { amount, occurred_on, occurred_time, note, is_extra_payment }
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
      occurred_time: parsed.data.occurred_time,
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
        entry.kind === "adjustment" ? "balance" : "amount",
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
