import { currentMonth, monthRange, shiftMonth, todayISO } from "@/libs/dates"
import { createClient } from "@/libs/supabase/server"
import type { Database } from "@/types/database"
import { type OccurrenceStatus, getOccurrenceStatus } from "./occurrences"

type RecurringExpenseRow =
  Database["public"]["Tables"]["recurring_expenses"]["Row"]
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"]
type OccurrenceRow =
  Database["public"]["Functions"]["recurring_occurrences"]["Returns"][number]

type CategorySummary = Pick<
  CategoryRow,
  "id" | "name" | "icon" | "color" | "archived_at"
>

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type RecurringExpense = Omit<RecurringExpenseRow, "amount"> & {
  amount: number
  category: CategorySummary
}

export interface UpcomingPayment {
  recurringExpenseId: string
  name: string
  amount: number
  category: CategorySummary
  dueOn: string
  transactionId: string | null
  paidAmount: number | null
  /** Cuenta del pago; null = fuera de las cuentas (o sin pagar) */
  accountName: string | null
  status: OccurrenceStatus
}

export interface OverdueSummary {
  count: number
  amount: number
  /** Mes (YYYY-MM) del atraso más antiguo; null sin atrasos */
  oldestMonth: string | null
}

export interface RecurringExpenseHistory {
  /** Ocurrencias desde el inicio, la más reciente primero, hasta `limit` */
  payments: UpcomingPayment[]
  /** Hay periodos más antiguos que `limit` */
  hasMore: boolean
  /** Pagado en el año actual */
  paidThisYear: number
  /** Ocurrencias impagas ya vencidas, a la fecha */
  overdueAmount: number
}

/** Filas visibles del historial de un gasto fijo antes de "Ver más" */
export const HISTORY_PAGE_SIZE = 12

const CATEGORY_COLUMNS = "id, name, icon, color, archived_at"

export async function getRecurringExpenses(
  workspaceId: string
): Promise<RecurringExpense[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("recurring_expenses")
    .select(`*, category:categories!inner (${CATEGORY_COLUMNS})`)
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true })

  if (error) {
    throw new Error("No se pudieron cargar los gastos fijos")
  }

  return data.map((row) => ({ ...row, amount: Number(row.amount) }))
}

/**
 * Mes (YYYY-MM) del `starts_on` más antiguo de los gastos fijos del espacio;
 * null si no hay gastos. Límite del navegador de mes y punto de partida de
 * los atrasos.
 */
export async function getRecurringStartMonth(
  workspaceId: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("recurring_expenses")
    .select("starts_on")
    .eq("workspace_id", workspaceId)
    .order("starts_on", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error("No se pudieron cargar los gastos fijos")
  }

  return data ? data.starts_on.slice(0, 7) : null
}

async function fetchOccurrences(
  supabase: SupabaseClient,
  workspaceId: string,
  from: string,
  to: string
): Promise<OccurrenceRow[]> {
  const { data, error } = await supabase.rpc("recurring_occurrences", {
    p_workspace_id: workspaceId,
    p_from: from,
    p_to: to
  })

  if (error) {
    throw new Error("No se pudieron cargar los pagos de los gastos fijos")
  }

  return data
}

// Agrega categoría, cuenta del pago y estado a cada ocurrencia
async function toUpcomingPayments(
  supabase: SupabaseClient,
  occurrences: OccurrenceRow[]
): Promise<UpcomingPayment[]> {
  if (occurrences.length === 0) {
    return []
  }

  const today = todayISO()
  const categoryIds = [...new Set(occurrences.map((row) => row.category_id))]
  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .in("id", categoryIds)

  if (categoriesError) {
    throw new Error("No se pudieron cargar los pagos de los gastos fijos")
  }

  const categoryById = new Map(categories.map((row) => [row.id, row]))

  // Cuenta de cada pago, desde su movimiento enlazado
  const paidIds = occurrences.flatMap((row) =>
    row.transaction_id === null ? [] : [row.transaction_id]
  )
  const accountByTransaction = new Map<string, string | null>()
  if (paidIds.length > 0) {
    const { data: paid, error: paidError } = await supabase
      .from("transactions")
      .select(
        "id, account:accounts!transactions_account_id_workspace_id_fkey (name)"
      )
      .in("id", paidIds)

    if (paidError) {
      throw new Error("No se pudieron cargar los pagos de los gastos fijos")
    }
    for (const row of paid) {
      accountByTransaction.set(row.id, row.account?.name ?? null)
    }
  }

  return occurrences.flatMap((row) => {
    const category = categoryById.get(row.category_id)
    if (!category) {
      return []
    }
    return {
      recurringExpenseId: row.recurring_expense_id,
      name: row.name,
      amount: Number(row.amount),
      category,
      dueOn: row.due_on,
      transactionId: row.transaction_id,
      paidAmount: row.paid_amount === null ? null : Number(row.paid_amount),
      accountName:
        row.transaction_id === null
          ? null
          : (accountByTransaction.get(row.transaction_id) ?? null),
      status: getOccurrenceStatus(row, today)
    }
  })
}

/**
 * Pagos de un mes (YYYY-MM), en orden de vencimiento.
 * - Mes actual: sus ocurrencias y todas las impagas anteriores desde el
 *   inicio de cada gasto (las atrasadas quedan primero).
 * - Mes anterior: todas sus ocurrencias, pagadas e impagas.
 */
export async function getUpcomingPayments(
  workspaceId: string,
  month: string = currentMonth()
): Promise<UpcomingPayment[]> {
  const supabase = await createClient()
  const range = monthRange(month)

  if (month !== currentMonth()) {
    const occurrences = await fetchOccurrences(
      supabase,
      workspaceId,
      range.from,
      range.to
    )
    return toUpcomingPayments(supabase, occurrences)
  }

  const startMonth = await getRecurringStartMonth(workspaceId)
  if (startMonth === null) {
    return []
  }

  const rows = await fetchOccurrences(
    supabase,
    workspaceId,
    monthRange(startMonth < month ? startMonth : month).from,
    range.to
  )
  const occurrences = rows.filter(
    (row) => row.due_on >= range.from || row.transaction_id === null
  )
  return toUpcomingPayments(supabase, occurrences)
}

/**
 * Ocurrencias impagas de meses anteriores al actual: cuántas, cuánto suman
 * y el mes de la más antigua.
 */
export async function getOverdueSummary(
  workspaceId: string
): Promise<OverdueSummary> {
  const empty: OverdueSummary = { count: 0, amount: 0, oldestMonth: null }
  const month = currentMonth()
  const startMonth = await getRecurringStartMonth(workspaceId)
  if (startMonth === null || startMonth >= month) {
    return empty
  }

  const supabase = await createClient()
  const rows = await fetchOccurrences(
    supabase,
    workspaceId,
    monthRange(startMonth).from,
    monthRange(shiftMonth(month, -1)).to
  )
  const unpaid = rows.filter((row) => row.transaction_id === null)
  if (unpaid.length === 0) {
    return empty
  }

  return {
    count: unpaid.length,
    amount: unpaid.reduce((total, row) => total + Number(row.amount), 0),
    // La RPC ordena por vencimiento
    oldestMonth: unpaid[0].due_on.slice(0, 7)
  }
}

/**
 * Ocurrencias de un gasto fijo desde su `starts_on` hasta el mes actual, la
 * más reciente primero, con los totales del Sheet. Un gasto pausado no tiene
 * ocurrencias (regla de `recurring_occurrences`).
 */
export async function getRecurringExpenseHistory(
  recurringExpenseId: string,
  options: { limit: number } = { limit: HISTORY_PAGE_SIZE }
): Promise<RecurringExpenseHistory> {
  const empty: RecurringExpenseHistory = {
    payments: [],
    hasMore: false,
    paidThisYear: 0,
    overdueAmount: 0
  }
  const supabase = await createClient()
  const { data: expense, error } = await supabase
    .from("recurring_expenses")
    .select("workspace_id, starts_on")
    .eq("id", recurringExpenseId)
    .maybeSingle()

  if (error) {
    throw new Error("No se pudo cargar el historial del gasto fijo")
  }

  const month = currentMonth()
  if (!expense || expense.starts_on.slice(0, 7) > month) {
    return empty
  }

  const rows = await fetchOccurrences(
    supabase,
    expense.workspace_id,
    expense.starts_on,
    monthRange(month).to
  )
  const occurrences = rows
    .filter((row) => row.recurring_expense_id === recurringExpenseId)
    .reverse()

  const today = todayISO()
  const year = month.slice(0, 4)
  let paidThisYear = 0
  let overdueAmount = 0
  for (const row of occurrences) {
    if (row.transaction_id === null) {
      if (row.due_on < today) {
        overdueAmount += Number(row.amount)
      }
    } else if (row.due_on.startsWith(year)) {
      paidThisYear += Number(row.paid_amount ?? row.amount)
    }
  }

  const visible = occurrences.slice(0, Math.max(1, options.limit))
  return {
    payments: await toUpcomingPayments(supabase, visible),
    hasMore: occurrences.length > visible.length,
    paidThisYear,
    overdueAmount
  }
}
