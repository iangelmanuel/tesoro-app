import "server-only"
import { z } from "zod"
import {
  type ServiceResult,
  type ServiceWorkspace,
  fail
} from "@/features/workspaces/service-result"
import { shiftMonth, todayISO } from "@/libs/dates"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Database } from "@/types/database"
import type { LoadedDebt } from "./debt-loader"
import {
  type DebtKind,
  creditCardSchema,
  habitualAccountSchema,
  loanSchema
} from "./debt-schemas"
import { DEBT_NOT_FOUND, NEGATIVE_BALANCE, debtPgError } from "./errors"
import { lastPeriodOn, periodOf } from "./receivable-schedule"
import {
  type ReceivableSchedule,
  monthlyReceivableSchema,
  receivableSchema
} from "./receivable-schemas"

// Crear y editar deudas y cuentas por cobrar (SPEC 44). Lo comparten las
// Server Actions y el MCP: recibe el cliente y el espacio Personal ya
// resuelto y devuelve las filas antes y después para el log.

export type DebtRow = Database["public"]["Tables"]["debts"]["Row"]
export type InstallmentHistoryRow =
  Database["public"]["Tables"]["receivable_installment_history"]["Row"]

const DEBT_DEFAULT_ERROR = "No se pudo guardar la deuda. Intenta de nuevo"
const NEGATIVE_OPENING = "Con este saldo inicial la deuda queda en negativo"
const ENTRIES_OUT_OF_RANGE =
  "Hay cobros de cuotas fuera de estas fechas. Elimínalos primero"

/** Esquema de cada tipo de deuda (la mensual por cobrar va aparte) */
const DEBT_SCHEMAS = {
  credit_card: creditCardSchema,
  loan: loanSchema,
  receivable: receivableSchema
} as const

/** Campos del formulario de cada tipo (debt-dialog.tsx) */
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

/** Campos que aplican a un tipo (y, en Me deben, a su tipo de cobro) */
export function debtFieldsFor(
  kind: DebtKind,
  schedule: ReceivableSchedule | null
): readonly string[] {
  return kind === "receivable" && schedule === "monthly"
    ? MONTHLY_RECEIVABLE_FIELDS
    : DEBT_FIELDS[kind]
}

export type DebtData = (
  | z.output<(typeof DEBT_SCHEMAS)[DebtKind]>
  | z.output<typeof monthlyReceivableSchema>
) & { account_id: string | null }

/**
 * Valida con el esquema del tipo (y, en una cuenta por cobrar, del tipo de
 * cobro) más la cuenta por defecto (SPEC 41). Los valores pueden llegar como
 * texto del formulario o ya tipados (MCP). Los errores se aplanan aquí
 * porque cada tipo tiene su propio esquema.
 */
export function parseDebtInput(
  kind: DebtKind,
  schedule: ReceivableSchedule | null,
  values: Record<string, unknown>
):
  | { success: true; data: DebtData }
  | { success: false; fieldErrors: Partial<Record<string, string[]>> } {
  const monthly = kind === "receivable" && schedule === "monthly"
  const result = (
    monthly ? monthlyReceivableSchema : DEBT_SCHEMAS[kind]
  ).safeParse(values)
  const account = habitualAccountSchema.safeParse(values.account_id ?? null)

  if (result.success && account.success) {
    return {
      success: true,
      data: { ...result.data, account_id: account.data } as DebtData
    }
  }
  return {
    success: false,
    fieldErrors: {
      ...(result.success
        ? {}
        : z.flattenError(result.error as z.ZodError).fieldErrors),
      ...(account.success
        ? {}
        : { account_id: z.flattenError(account.error).formErrors })
    }
  }
}

/** La cuenta por defecto, si llega, debe ser del espacio y estar activa */
async function validateHabitualAccount(
  supabase: AppSupabase,
  workspaceId: string,
  accountId: string | null
): Promise<string | null> {
  if (accountId === null) return null
  const { data } = await supabase
    .from("accounts")
    .select("archived_at")
    .eq("id", accountId)
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  if (!data) return "Elige una cuenta de tu espacio"
  if (data.archived_at !== null) {
    return "Esta cuenta está archivada. Elige otra"
  }
  return null
}

/** Crea una deuda o cuenta por cobrar y devuelve la fila creada */
export async function createDebtRecord(
  supabase: AppSupabase,
  workspace: Pick<ServiceWorkspace, "id">,
  kind: DebtKind,
  data: DebtData
): Promise<ServiceResult<{ after: DebtRow }>> {
  const accountError = await validateHabitualAccount(
    supabase,
    workspace.id,
    data.account_id
  )
  if (accountError) {
    return fail({ fieldErrors: { account_id: [accountError] } })
  }

  const { data: after, error } = await supabase
    .from("debts")
    .insert({ ...data, kind, workspace_id: workspace.id })
    .select("*")
    .single()

  if (error) {
    return fail(
      debtPgError(
        error,
        "opening_balance",
        NEGATIVE_BALANCE,
        DEBT_DEFAULT_ERROR
      )
    )
  }
  return { ok: true, after }
}

/** Fila completa de la deuda del espacio, o null */
export async function loadDebtRow(
  supabase: AppSupabase,
  workspaceId: string,
  id: string
): Promise<DebtRow | null> {
  const { data } = await supabase
    .from("debts")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  return data
}

/**
 * Al cambiar el valor de una mensual indefinida, guarda el anterior hasta el
 * mes pasado (SPEC 29). Devuelve la fila creada, null si no hacía falta, o
 * "error" si falló.
 */
async function keepPreviousInstallment(
  supabase: AppSupabase,
  debt: LoadedDebt,
  startsOn: string,
  newValue: number
): Promise<InstallmentHistoryRow | null | "error"> {
  if (debt.installment === null) {
    return null
  }
  const previousValue = Number(debt.installment)
  const lastMonth = `${shiftMonth(todayISO().slice(0, 7), -1)}-01`
  if (previousValue === newValue || periodOf(startsOn) > lastMonth) {
    return null
  }

  const { data: covered, error: readError } = await supabase
    .from("receivable_installment_history")
    .select("id")
    .eq("debt_id", debt.id)
    .gte("through_period", lastMonth)
    .limit(1)

  if (readError) {
    return "error"
  }
  if (covered.length > 0) {
    return null
  }

  const { data, error } = await supabase
    .from("receivable_installment_history")
    .insert({
      workspace_id: debt.workspace_id,
      debt_id: debt.id,
      through_period: lastMonth,
      amount: previousValue
    })
    .select("*")
    .single()
  return error ? "error" : data
}

/**
 * Edita una deuda ya cargada (con su saldo y abonos). El tipo y el tipo de
 * cobro no cambian: `data` ya viene validado con el esquema de los
 * guardados. `history` es el valor anterior de una mensual indefinida que se
 * guardó (SPEC 29), para el log del MCP.
 */
export async function updateDebtRecord(
  supabase: AppSupabase,
  debt: LoadedDebt,
  data: DebtData
): Promise<
  ServiceResult<{
    before: DebtRow
    after: DebtRow
    history: InstallmentHistoryRow | null
  }>
> {
  const accountError = await validateHabitualAccount(
    supabase,
    debt.workspace_id,
    data.account_id
  )
  if (accountError) {
    return fail({ fieldErrors: { account_id: [accountError] } })
  }

  // Cobro mensual: los cobros ya hechos deben seguir dentro de las cuotas
  const monthlyForm = "starts_on" in data && data.starts_on !== null
  if ("starts_on" in data && data.starts_on !== null) {
    const first = periodOf(data.starts_on)
    const last = lastPeriodOn({
      starts_on: data.starts_on,
      term_months: data.term_months
    })
    const outside = debt.entries.some((entry) =>
      entry.allocations.some(
        ({ period_on }) =>
          period_on < first || (last !== null && period_on > last)
      )
    )
    if (outside) {
      return fail({ fieldErrors: { starts_on: [ENTRIES_OUT_OF_RANGE] } })
    }
  }

  // El saldo cambia lo mismo que el saldo inicial. Una mensual indefinida no
  // tiene saldo total. En una mensual con cuotas el saldo inicial sale de las
  // cuotas, así que el error va en ellas.
  const newBalance =
    debt.balance - Number(debt.opening_balance) + data.opening_balance
  const openEnded = monthlyForm && data.term_months === null
  if (newBalance < 0 && !openEnded) {
    return fail({
      fieldErrors: {
        [monthlyForm ? "term_months" : "opening_balance"]: [NEGATIVE_OPENING]
      }
    })
  }

  const before = await loadDebtRow(supabase, debt.workspace_id, debt.id)
  if (!before) {
    return fail({ error: DEBT_NOT_FOUND })
  }

  // Mensual indefinida con un valor nuevo (SPEC 29): los meses ya corridos
  // conservan el valor anterior, así sus abonos no quedan cortos
  let history: InstallmentHistoryRow | null = null
  if (
    monthlyForm &&
    debt.openEnded &&
    "installment" in data &&
    data.installment !== null
  ) {
    const kept = await keepPreviousInstallment(
      supabase,
      debt,
      data.starts_on as string,
      data.installment
    )
    if (kept === "error") {
      return fail({ error: DEBT_DEFAULT_ERROR })
    }
    history = kept
  }

  const { data: updated, error } = await supabase
    .from("debts")
    .update(data)
    .eq("id", debt.id)
    .eq("workspace_id", debt.workspace_id)
    .select("*")

  if (error) {
    return fail(
      debtPgError(
        error,
        "opening_balance",
        NEGATIVE_OPENING,
        DEBT_DEFAULT_ERROR
      )
    )
  }
  const after = updated[0]
  if (!after) {
    return fail({ error: DEBT_NOT_FOUND })
  }
  return { ok: true, before, after, history }
}

/** Estado guardado de una deuda */
export type DebtRowStatus = DebtRow["status"]

const DEBT_TRANSITION_ERROR = "No se pudo actualizar la deuda. Intenta de nuevo"
const HAS_BALANCE = "La deuda aún tiene saldo"
const OPEN_ENDED_PAID = "Un cobro mensual sin número de cuotas se archiva"

/**
 * Cambia el estado de la deuda solo si está en uno de los estados `from`
 * (pagar, archivar, reactivar). Al pagarla guarda `closed_at`; en los demás
 * casos lo limpia.
 */
export async function transitionDebtRecord(
  supabase: AppSupabase,
  workspace: Pick<ServiceWorkspace, "id">,
  id: string,
  from: DebtRowStatus[],
  to: DebtRowStatus
): Promise<ServiceResult<object>> {
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
    return fail({ error: DEBT_TRANSITION_ERROR })
  }
  if (data.length === 0) {
    return fail({ error: DEBT_NOT_FOUND })
  }
  return { ok: true }
}

/**
 * Marca una deuda como pagada (o cobrada): sin saldo. Una mensual indefinida
 * no tiene saldo total: sigue activa hasta archivarla.
 */
export async function markDebtPaidRecord(
  supabase: AppSupabase,
  workspace: Pick<ServiceWorkspace, "id">,
  debt: Pick<LoadedDebt, "id" | "balance" | "openEnded">
): Promise<ServiceResult<object>> {
  if (debt.balance > 0) {
    return fail({ error: HAS_BALANCE })
  }
  if (debt.openEnded) {
    return fail({ error: OPEN_ENDED_PAID })
  }
  return transitionDebtRecord(supabase, workspace, debt.id, ["active"], "paid")
}
