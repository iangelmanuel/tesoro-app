import { createClient } from "@/libs/supabase/server"
import type { Database } from "@/types/database"

type DebtRow = Database["public"]["Tables"]["debts"]["Row"]
type DebtEntryRow = Database["public"]["Tables"]["debt_entries"]["Row"]

// Los tipos generados de debt_overview marcan todo como no nulo; las columnas
// de la tabla sí traen la nulabilidad real
export type Debt = Omit<
  DebtRow,
  | "opening_balance"
  | "credit_limit"
  | "min_payment"
  | "installment"
  | "original_amount"
  | "interest_rate"
> & {
  opening_balance: number
  credit_limit: number | null
  min_payment: number | null
  installment: number | null
  original_amount: number | null
  interest_rate: number | null
  balance: number
  paid_total: number
  entries_count: number
  last_payment_on: string | null
  next_due_on: string | null
  prev_due_on: string | null
  paid_current_cycle: number | null
  paid_previous_cycle: number | null
}

export type DebtEntry = Omit<DebtEntryRow, "amount"> & {
  amount: number
}

const toNumber = (value: number | string | null) =>
  value === null ? null : Number(value)

// Todas las deudas y cuentas por cobrar del espacio, en cualquier estado,
// con su saldo y ciclo de pago
export async function getDebts(workspaceId: string): Promise<Debt[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("debt_overview", {
    p_workspace_id: workspaceId
  })

  if (error) {
    throw new Error("No se pudieron cargar las deudas")
  }

  return data.map((row) => ({
    ...row,
    counterparty: row.counterparty ?? null,
    closing_day: row.closing_day ?? null,
    term_months: row.term_months ?? null,
    rate_type: row.rate_type ?? null,
    due_day: row.due_day ?? null,
    expected_on: row.expected_on ?? null,
    closed_at: row.closed_at ?? null,
    last_payment_on: row.last_payment_on ?? null,
    next_due_on: row.next_due_on ?? null,
    prev_due_on: row.prev_due_on ?? null,
    opening_balance: Number(row.opening_balance),
    credit_limit: toNumber(row.credit_limit),
    min_payment: toNumber(row.min_payment),
    installment: toNumber(row.installment),
    original_amount: toNumber(row.original_amount),
    interest_rate: toNumber(row.interest_rate),
    balance: Number(row.balance),
    paid_total: Number(row.paid_total),
    entries_count: Number(row.entries_count),
    paid_current_cycle: toNumber(row.paid_current_cycle),
    paid_previous_cycle: toNumber(row.paid_previous_cycle)
  }))
}

// Pagos y ajustes de una deuda, el más reciente primero
export async function getDebtEntries(debtId: string): Promise<DebtEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("debt_entries")
    .select("*")
    .eq("debt_id", debtId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error("No se pudieron cargar los pagos")
  }

  return data.map((row) => ({ ...row, amount: Number(row.amount) }))
}
