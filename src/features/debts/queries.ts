import { createClient } from "@/libs/supabase/server"
import type { Database } from "@/types/database"
import type { EntryAllocation, InstallmentRate } from "./receivable-schedule"

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
  | "fee_amount"
> & {
  opening_balance: number
  credit_limit: number | null
  min_payment: number | null
  installment: number | null
  original_amount: number | null
  interest_rate: number | null
  fee_amount: number | null
  balance: number
  paid_total: number
  entries_count: number
  last_payment_on: string | null
  next_due_on: string | null
  prev_due_on: string | null
  paid_current_cycle: number | null
  paid_previous_cycle: number | null
  /** Σ cuotas de compras del próximo vencimiento y del anterior (SPEC 42) */
  installments_due_current: number | null
  installments_due_previous: number | null
  /** Valores anteriores de la cuota de una mensual indefinida (SPEC 29) */
  installment_history: InstallmentRate[]
}

export type DebtEntry = Omit<DebtEntryRow, "amount"> & {
  amount: number
  /**
   * Cuenta del pago o avance: la propia de una tarjeta o la del movimiento
   * enlazado en préstamos y cuentas por cobrar. null = fuera de las cuentas.
   */
  account_name: string | null
  /**
   * id de esa cuenta (SPEC 42): prellena la cuenta al editar el pago. null =
   * fuera de las cuentas
   */
  payment_account_id: string | null
  /** Descripción y categoría del movimiento enlazado; null sin movimiento */
  description: string | null
  category_id: string | null
  /** Cuotas que cubre un abono de una mensual (SPEC 39); vacío en el resto */
  allocations: EntryAllocation[]
}

const toNumber = (value: number | string | null) =>
  value === null ? null : Number(value)

// Todas las deudas y cuentas por cobrar del espacio, en cualquier estado,
// con su saldo y ciclo de pago
export async function getDebts(workspaceId: string): Promise<Debt[]> {
  const supabase = await createClient()
  const [{ data, error }, history] = await Promise.all([
    supabase.rpc("debt_overview", { p_workspace_id: workspaceId }),
    supabase
      .from("receivable_installment_history")
      .select("debt_id, through_period, amount")
      .eq("workspace_id", workspaceId)
  ])

  if (error || history.error) {
    throw new Error("No se pudieron cargar las deudas")
  }

  const historyByDebt = new Map<string, InstallmentRate[]>()
  for (const row of history.data) {
    const list = historyByDebt.get(row.debt_id) ?? []
    list.push({
      through_period: row.through_period,
      amount: Number(row.amount)
    })
    historyByDebt.set(row.debt_id, list)
  }

  return data.map((row) => ({
    installment_history: historyByDebt.get(row.id) ?? [],
    ...row,
    account_id: row.account_id ?? null,
    counterparty: row.counterparty ?? null,
    closing_day: row.closing_day ?? null,
    term_months: row.term_months ?? null,
    rate_type: row.rate_type ?? null,
    due_day: row.due_day ?? null,
    expected_on: row.expected_on ?? null,
    schedule: row.schedule ?? null,
    starts_on: row.starts_on ?? null,
    fee_day: row.fee_day ?? null,
    fee_charged_through: row.fee_charged_through ?? null,
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
    fee_amount: toNumber(row.fee_amount),
    balance: Number(row.balance),
    paid_total: Number(row.paid_total),
    entries_count: Number(row.entries_count),
    paid_current_cycle: toNumber(row.paid_current_cycle),
    paid_previous_cycle: toNumber(row.paid_previous_cycle),
    installments_due_current: toNumber(row.installments_due_current ?? null),
    installments_due_previous: toNumber(row.installments_due_previous ?? null)
  }))
}

const ENTRY_COLUMNS =
  "*, account:accounts!debt_entries_account_id_workspace_id_fkey (name), transaction:transactions!debt_entries_transaction_id_fkey (account_id, description, category_id, account:accounts!transactions_account_id_workspace_id_fkey (name)), allocations:debt_entry_allocations (period_on, amount)"

// Pagos, avances y ajustes de una deuda, el más reciente primero
export async function getDebtEntries(debtId: string): Promise<DebtEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("debt_entries")
    .select(ENTRY_COLUMNS)
    .eq("debt_id", debtId)
    .order("occurred_on", { ascending: false })
    // Orden manual dentro del día (SPEC 19 y 45)
    .order("day_position", { ascending: true })
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error("No se pudieron cargar los pagos")
  }

  return data.map(toDebtEntry)
}

/** Un movimiento de una deuda, o null si no existe o es ajeno (RLS) */
export async function getDebtEntry(entryId: string): Promise<DebtEntry | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("debt_entries")
    .select(ENTRY_COLUMNS)
    .eq("id", entryId)
    .maybeSingle()

  if (error) {
    throw new Error("No se pudo cargar el movimiento")
  }
  return data ? toDebtEntry(data) : null
}

type EntryRowWithLinks = {
  account: { name: string } | null
  transaction: {
    account_id: string | null
    description: string
    category_id: string
    account: { name: string } | null
  } | null
  allocations: { period_on: string; amount: number | string }[]
} & DebtEntryRow

function toDebtEntry({
  account,
  transaction,
  allocations,
  ...row
}: EntryRowWithLinks): DebtEntry {
  return {
    ...row,
    amount: Number(row.amount),
    account_name: account?.name ?? transaction?.account?.name ?? null,
    payment_account_id: row.account_id ?? transaction?.account_id ?? null,
    description: transaction?.description ?? null,
    category_id: transaction?.category_id ?? null,
    allocations: allocations
      .map((allocation) => ({
        period_on: allocation.period_on,
        amount: Number(allocation.amount)
      }))
      .sort((a, b) => a.period_on.localeCompare(b.period_on))
  }
}

/** Movimiento suelto que puede ser el pago real de un ajuste (SPEC 42) */
export interface LinkableTransaction {
  id: string
  occurred_on: string
  occurred_time: string | null
  description: string
  note: string | null
  account_id: string | null
  /** null = fuera de las cuentas */
  account_name: string | null
  amount: number
}

/** Días de margen alrededor de la fecha del ajuste para sugerir candidatos */
export const LINKABLE_DAYS = 7

/** Fecha YYYY-MM-DD desplazada `days` días, sin pasar por la zona local */
function shiftDay(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10)
}

/**
 * Movimientos ya registrados que pueden ser el de un pago, cobro o avance
 * (SPEC 42): del espacio de la deuda, del tipo dado, con el mismo monto y
 * fecha a ±7 días, sin enlazar a un abono ni a un gasto o ingreso fijo. Los
 * más cercanos a la fecha primero.
 */
export async function findLinkableTransactions(
  debtId: string,
  amount: number,
  occurredOn: string,
  type: "income" | "expense"
): Promise<LinkableTransaction[]> {
  const supabase = await createClient()
  const { data: debt } = await supabase
    .from("debts")
    .select("workspace_id")
    .eq("id", debtId)
    .maybeSingle()

  if (!debt) {
    return []
  }

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, occurred_on, occurred_time, description, note, account_id, amount, account:accounts!transactions_account_id_workspace_id_fkey (name), debt_entries (id)"
    )
    .eq("workspace_id", debt.workspace_id)
    .eq("type", type)
    .eq("amount", amount)
    .gte("occurred_on", shiftDay(occurredOn, -LINKABLE_DAYS))
    .lte("occurred_on", shiftDay(occurredOn, LINKABLE_DAYS))
    .is("recurring_expense_id", null)
    .is("recurring_income_id", null)

  if (error) {
    throw new Error("No se pudieron cargar los movimientos")
  }

  const distance = (date: string) =>
    Math.abs(Date.parse(date) - Date.parse(occurredOn))

  return data
    .filter((row) => row.debt_entries === null)
    .map(({ account, debt_entries: _link, ...row }) => {
      void _link
      return {
        ...row,
        amount: Number(row.amount),
        account_name: account?.name ?? null
      }
    })
    .sort((a, b) => distance(a.occurred_on) - distance(b.occurred_on))
}
