import { currentMonth, monthRange, shiftMonth, todayISO } from "@/libs/dates"
import { createClient } from "@/libs/supabase/server"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Database } from "@/types/database"
import {
  type IncomeOccurrenceStatus,
  getIncomeOccurrenceStatus
} from "./occurrences"
import { type IncomeReceiptPeriods, incomeReceiptPeriods } from "./receipt"
import type { IncomeFrequency } from "./schemas"

export { OTHER_INCOME } from "./schemas"

type RecurringIncomeRow =
  Database["public"]["Tables"]["recurring_incomes"]["Row"]
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"]

type CategorySummary = Pick<
  CategoryRow,
  "id" | "name" | "icon" | "color" | "archived_at"
>

export type RecurringIncome = Omit<RecurringIncomeRow, "amount"> & {
  amount: number
  category: CategorySummary
  /** Nombre de la cuenta por defecto; null sin cuenta */
  accountName: string | null
  /** Solo fuentes "none": recibido en el mes y en el año actuales */
  received: { month: number; year: number } | null
}

export interface UpcomingIncome {
  recurringIncomeId: string
  name: string
  amount: number
  category: CategorySummary
  /** Cuenta por defecto del ingreso fijo */
  accountId: string | null
  frequency: IncomeFrequency
  dueOn: string
  transactionId: string | null
  receivedAmount: number | null
  /** Cuenta del ingreso recibido; null = fuera de las cuentas (o sin recibir) */
  accountName: string | null
  status: IncomeOccurrenceStatus
}

export interface IncomeSourceOption extends IncomeReceiptPeriods {
  id: string
  name: string
  amount: number
  category_id: string
  account_id: string | null
  frequency: IncomeFrequency
}

// Meses anteriores al actual cuyas ocurrencias no recibidas siguen en la lista
const OVERDUE_MONTHS = 2

const CATEGORY_COLUMNS = "id, name, icon, color, archived_at"

/** Ventana de "Próximos ingresos": 2 meses atrás hasta el fin del mes actual */
function upcomingWindow() {
  const month = currentMonth()
  return {
    from: monthRange(shiftMonth(month, -OVERDUE_MONTHS)).from,
    to: monthRange(month).to,
    monthStart: monthRange(month).from
  }
}

// `client` permite usarla fuera de una request con cookies (MCP, SPEC 34)
async function fetchOccurrences(workspaceId: string, client?: AppSupabase) {
  const { from, to } = upcomingWindow()
  const supabase = client ?? (await createClient())
  const { data, error } = await supabase.rpc("recurring_income_occurrences", {
    p_workspace_id: workspaceId,
    p_from: from,
    p_to: to
  })

  if (error) {
    throw new Error("No se pudieron cargar los próximos ingresos")
  }
  return data
}

export async function getRecurringIncomes(
  workspaceId: string
): Promise<RecurringIncome[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("recurring_incomes")
    .select(
      `*, category:categories!inner (${CATEGORY_COLUMNS}), account:accounts (name)`
    )
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true })

  if (error) {
    throw new Error("No se pudieron cargar los ingresos fijos")
  }

  // Lo recibido en el mes y el año de las fuentes sin fecha fija
  const noneIds = data
    .filter((row) => row.frequency === "none")
    .map((row) => row.id)
  const received = new Map<string, { month: number; year: number }>()

  if (noneIds.length > 0) {
    const month = currentMonth()
    const year = month.slice(0, 4)
    const { data: rows, error: rowsError } = await supabase
      .from("transactions")
      .select("recurring_income_id, amount, occurred_on")
      .eq("workspace_id", workspaceId)
      .in("recurring_income_id", noneIds)
      .gte("occurred_on", `${year}-01-01`)
      .lte("occurred_on", `${year}-12-31`)

    if (rowsError) {
      throw new Error("No se pudieron cargar los ingresos fijos")
    }

    for (const id of noneIds) {
      received.set(id, { month: 0, year: 0 })
    }
    for (const row of rows) {
      const totals =
        row.recurring_income_id === null
          ? undefined
          : received.get(row.recurring_income_id)
      if (!totals) continue
      const amount = Number(row.amount)
      totals.year += amount
      if (row.occurred_on.startsWith(month)) {
        totals.month += amount
      }
    }
  }

  return data.map(({ account, ...row }) => ({
    ...row,
    amount: Number(row.amount),
    accountName: account?.name ?? null,
    received: received.get(row.id) ?? null
  }))
}

// Todas las ocurrencias del mes actual y las no recibidas de los 2 meses
// anteriores, en orden de vencimiento (las atrasadas quedan primero)
export async function getUpcomingIncomes(
  workspaceId: string
): Promise<UpcomingIncome[]> {
  const { monthStart } = upcomingWindow()
  const today = todayISO()
  const data = await fetchOccurrences(workspaceId)

  const occurrences = data.filter(
    (row) => row.due_on >= monthStart || row.transaction_id === null
  )
  if (occurrences.length === 0) {
    return []
  }

  const supabase = await createClient()
  const incomeIds = [...new Set(occurrences.map((r) => r.recurring_income_id))]
  const categoryIds = [...new Set(occurrences.map((row) => row.category_id))]

  const [incomes, categories] = await Promise.all([
    supabase
      .from("recurring_incomes")
      .select("id, frequency")
      .in("id", incomeIds),
    supabase.from("categories").select(CATEGORY_COLUMNS).in("id", categoryIds)
  ])

  if (incomes.error || categories.error) {
    throw new Error("No se pudieron cargar los próximos ingresos")
  }

  const frequencyById = new Map(
    incomes.data.map((row) => [row.id, row.frequency])
  )
  const categoryById = new Map(categories.data.map((row) => [row.id, row]))

  // Cuenta de cada ingreso recibido, desde su movimiento enlazado
  const receivedIds = occurrences.flatMap((row) =>
    row.transaction_id === null ? [] : [row.transaction_id]
  )
  const accountByTransaction = new Map<string, string | null>()
  if (receivedIds.length > 0) {
    const { data: received, error: receivedError } = await supabase
      .from("transactions")
      .select(
        "id, account:accounts!transactions_account_id_workspace_id_fkey (name)"
      )
      .in("id", receivedIds)

    if (receivedError) {
      throw new Error("No se pudieron cargar los próximos ingresos")
    }
    for (const row of received) {
      accountByTransaction.set(row.id, row.account?.name ?? null)
    }
  }

  return occurrences.flatMap((row) => {
    const category = categoryById.get(row.category_id)
    const frequency = frequencyById.get(row.recurring_income_id)
    if (!category || !frequency) {
      return []
    }
    return {
      recurringIncomeId: row.recurring_income_id,
      name: row.name,
      amount: Number(row.amount),
      category,
      accountId: row.account_id,
      frequency,
      dueOn: row.due_on,
      transactionId: row.transaction_id,
      receivedAmount:
        row.received_amount === null ? null : Number(row.received_amount),
      accountName:
        row.transaction_id === null
          ? null
          : (accountByTransaction.get(row.transaction_id) ?? null),
      status: getIncomeOccurrenceStatus(row, today)
    }
  })
}

/**
 * Lo asignado a cada ocurrencia de estos ingresos fijos, por fuente y fecha.
 * `client` permite usarla fuera de una request con cookies (MCP, SPEC 34).
 */
export async function getReceivedByOccurrence(
  incomeIds: string[],
  client?: AppSupabase
): Promise<Map<string, Map<string, number>>> {
  const received = new Map<string, Map<string, number>>()
  if (incomeIds.length === 0) {
    return received
  }

  const supabase = client ?? (await createClient())
  const { data, error } = await supabase
    .from("recurring_income_allocations")
    .select("recurring_income_id, due_on, amount")
    .in("recurring_income_id", incomeIds)

  if (error) {
    throw new Error("No se pudieron cargar los ingresos fijos")
  }

  for (const row of data) {
    const byDate = received.get(row.recurring_income_id) ?? new Map()
    const cents =
      Math.round((byDate.get(row.due_on) ?? 0) * 100) +
      Math.round(Number(row.amount) * 100)
    byDate.set(row.due_on, cents / 100)
    received.set(row.recurring_income_id, byDate)
  }
  return received
}

/**
 * Ingresos fijos activos para el select "Ingreso fijo" y **Recibir**, con las
 * ocurrencias en las que un cobro nuevo se puede repartir (vista previa)
 */
export async function getIncomeSources(
  workspaceId: string
): Promise<IncomeSourceOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("recurring_incomes")
    .select(
      "id, name, amount, category_id, account_id, frequency, day_of_month, second_day_of_month, month_of_year, day_of_week, interval_days, starts_on, ends_on"
    )
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) {
    throw new Error("No se pudieron cargar los ingresos fijos")
  }

  const today = todayISO()
  const received = await getReceivedByOccurrence(
    data.filter((row) => row.frequency !== "none").map((row) => row.id)
  )

  return data.map((row) => {
    const amount = Number(row.amount)
    const { periods, futureLimited } = incomeReceiptPeriods(
      { ...row, amount },
      received.get(row.id) ?? new Map(),
      today
    )
    return {
      id: row.id,
      name: row.name,
      amount,
      category_id: row.category_id,
      account_id: row.account_id,
      frequency: row.frequency,
      periods,
      futureLimited
    }
  })
}
