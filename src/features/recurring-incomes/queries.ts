import { currentMonth, monthRange, shiftMonth, todayISO } from "@/libs/dates"
import { createClient } from "@/libs/supabase/server"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Database } from "@/types/database"
import {
  type IncomeOccurrenceStatus,
  getIncomeOccurrenceStatus,
  incomeDueDates,
  occurrenceRemaining
} from "./occurrences"
import {
  type IncomeReceiptPeriods,
  addDays,
  futureWindowEnd,
  incomeReceiptPeriods
} from "./receipt"
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

/** Una ocurrencia de un ingreso fijo con lo recibido y su estado */
export interface UpcomingIncome {
  recurringIncomeId: string
  name: string
  /** Monto esperado */
  amount: number
  category: CategorySummary
  /** Cuenta por defecto del ingreso fijo */
  accountId: string | null
  frequency: IncomeFrequency
  dueOn: string
  /** Suma de lo asignado a esta ocurrencia (0 sin cobros) */
  receivedAmount: number
  /** Lo que falta (0 si ya se recibió) */
  remaining: number
  status: IncomeOccurrenceStatus
}

/** Ocurrencias de meses anteriores sin recibir completas */
export interface IncomeOverdueSummary {
  count: number
  /** Lo que falta de todas ellas */
  amount: number
  /** Mes (YYYY-MM) de la más antigua; null sin atrasos */
  oldestMonth: string | null
}

export interface IncomeSourceOption extends IncomeReceiptPeriods {
  id: string
  name: string
  amount: number
  category_id: string
  account_id: string | null
  frequency: IncomeFrequency
}

const CATEGORY_COLUMNS = "id, name, icon, color, archived_at"

/**
 * Mes (YYYY-MM) del `starts_on` más antiguo de los ingresos fijos con
 * calendario; null si no hay. Límite del navegador de mes.
 */
export async function getRecurringIncomeStartMonth(
  workspaceId: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("recurring_incomes")
    .select("starts_on")
    .eq("workspace_id", workspaceId)
    .neq("frequency", "none")
    .order("starts_on", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error("No se pudieron cargar los ingresos fijos")
  }
  return data ? data.starts_on.slice(0, 7) : null
}

async function fetchOccurrences(workspaceId: string, from: string, to: string) {
  const supabase = await createClient()
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

type OccurrenceRow = Awaited<ReturnType<typeof fetchOccurrences>>[number]

// Agrega categoría, frecuencia, lo que falta y el estado a cada ocurrencia
async function toUpcomingIncomes(
  rows: OccurrenceRow[]
): Promise<UpcomingIncome[]> {
  if (rows.length === 0) {
    return []
  }

  const supabase = await createClient()
  const incomeIds = [...new Set(rows.map((row) => row.recurring_income_id))]
  const categoryIds = [...new Set(rows.map((row) => row.category_id))]

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
  const today = todayISO()

  return rows.flatMap((row) => {
    const category = categoryById.get(row.category_id)
    const frequency = frequencyById.get(row.recurring_income_id)
    if (!category || !frequency) {
      return []
    }
    const occurrence = {
      due_on: row.due_on,
      amount: Number(row.amount),
      received_amount: Number(row.received_amount)
    }
    return {
      recurringIncomeId: row.recurring_income_id,
      name: row.name,
      amount: occurrence.amount,
      category,
      accountId: row.account_id,
      frequency,
      dueOn: row.due_on,
      receivedAmount: occurrence.received_amount,
      remaining: occurrenceRemaining(occurrence),
      status: getIncomeOccurrenceStatus(occurrence, today)
    }
  })
}

/**
 * Ocurrencias del mes elegido (YYYY-MM; por defecto el actual), en orden de
 * vencimiento:
 * - mes actual: las del mes y todas las no recibidas o abonadas de meses
 *   anteriores, desde el inicio de cada ingreso fijo (sin tope de meses);
 * - mes anterior: todas las de ese mes, con su estado.
 */
export async function getUpcomingIncomes(
  workspaceId: string,
  month: string = currentMonth()
): Promise<UpcomingIncome[]> {
  const range = monthRange(month)

  if (month !== currentMonth()) {
    return toUpcomingIncomes(
      await fetchOccurrences(workspaceId, range.from, range.to)
    )
  }

  const startMonth = await getRecurringIncomeStartMonth(workspaceId)
  if (startMonth === null) {
    return []
  }

  const rows = await fetchOccurrences(
    workspaceId,
    monthRange(startMonth < month ? startMonth : month).from,
    range.to
  )
  return toUpcomingIncomes(
    rows.filter(
      (row) =>
        row.due_on >= range.from ||
        Number(row.received_amount) < Number(row.amount)
    )
  )
}

/**
 * Ocurrencias de meses anteriores al actual sin recibir completas (atrasadas
 * o abonadas): cuántas, cuánto falta y el mes de la más antigua.
 */
export async function getIncomeOverdueSummary(
  workspaceId: string
): Promise<IncomeOverdueSummary> {
  const empty: IncomeOverdueSummary = {
    count: 0,
    amount: 0,
    oldestMonth: null
  }
  const month = currentMonth()
  const startMonth = await getRecurringIncomeStartMonth(workspaceId)
  if (startMonth === null || startMonth >= month) {
    return empty
  }

  const rows = await fetchOccurrences(
    workspaceId,
    monthRange(startMonth).from,
    monthRange(shiftMonth(month, -1)).to
  )
  const open = rows.flatMap((row) => {
    const remaining = occurrenceRemaining({
      amount: Number(row.amount),
      received_amount: Number(row.received_amount)
    })
    return remaining > 0 ? [{ dueOn: row.due_on, remaining }] : []
  })
  if (open.length === 0) {
    return empty
  }

  const cents = open.reduce(
    (total, row) => total + Math.round(row.remaining * 100),
    0
  )
  return {
    count: open.length,
    amount: cents / 100,
    // La RPC ordena por vencimiento
    oldestMonth: open[0].dueOn.slice(0, 7)
  }
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

/** Un movimiento que cubre (toda o parte de) una ocurrencia */
export interface IncomeReceipt {
  transactionId: string
  occurredOn: string
  description: string
  /** Lo que este movimiento asignó a la ocurrencia */
  amount: number
}

/** Ocurrencia del Sheet de un ingreso fijo, con los movimientos que la cubren */
export interface IncomeHistoryRow {
  dueOn: string
  amount: number
  receivedAmount: number
  remaining: number
  status: IncomeOccurrenceStatus
  receipts: IncomeReceipt[]
}

export interface RecurringIncomeHistory {
  /** Desde `starts_on` hasta hoy más la próxima, la más reciente primero */
  occurrences: IncomeHistoryRow[]
  /** Hay ocurrencias más antiguas que `limit` */
  hasMore: boolean
  /** Recibido en ocurrencias del año actual */
  receivedThisYear: number
  /** Lo que falta de las ocurrencias vencidas o de hoy */
  dueToDate: number
}

/**
 * Ocurrencias de un ingreso fijo para su Sheet (SPEC 38): desde `starts_on`
 * hasta hoy más la próxima, la más reciente primero, con lo recibido y los
 * movimientos que cubren cada una. Las asignaciones cuya fecha ya no calza
 * con el calendario (la fuente cambió de días) se muestran en su fecha.
 * "Sin fecha fija" no tiene ocurrencias.
 */
export async function getRecurringIncomeHistory(
  recurringIncomeId: string,
  options: { limit: number }
): Promise<RecurringIncomeHistory> {
  const empty: RecurringIncomeHistory = {
    occurrences: [],
    hasMore: false,
    receivedThisYear: 0,
    dueToDate: 0
  }
  const supabase = await createClient()
  const [{ data: income, error }, { data: allocations, error: allocError }] =
    await Promise.all([
      supabase
        .from("recurring_incomes")
        .select(
          "amount, frequency, day_of_month, second_day_of_month, month_of_year, day_of_week, interval_days, starts_on, ends_on"
        )
        .eq("id", recurringIncomeId)
        .maybeSingle(),
      supabase
        .from("recurring_income_allocations")
        .select(
          "due_on, amount, transaction:transactions (id, occurred_on, description)"
        )
        .eq("recurring_income_id", recurringIncomeId)
        .order("created_at", { ascending: true })
    ])

  if (error || allocError) {
    throw new Error("No se pudo cargar el historial del ingreso fijo")
  }
  if (!income || income.frequency === "none") {
    return empty
  }

  const schedule = { ...income, amount: Number(income.amount) }
  const today = todayISO()
  const next = incomeDueDates(
    schedule,
    addDays(today, 1),
    futureWindowEnd(schedule, today)
  )[0]
  const dates = new Set(incomeDueDates(schedule, schedule.starts_on, today))
  if (next !== undefined) {
    dates.add(next)
  }

  const receiptsByDate = new Map<string, IncomeReceipt[]>()
  for (const allocation of allocations) {
    dates.add(allocation.due_on)
    const list = receiptsByDate.get(allocation.due_on) ?? []
    list.push({
      transactionId: allocation.transaction.id,
      occurredOn: allocation.transaction.occurred_on,
      description: allocation.transaction.description,
      amount: Number(allocation.amount)
    })
    receiptsByDate.set(allocation.due_on, list)
  }

  const year = today.slice(0, 4)
  let receivedCents = 0
  let dueCents = 0
  const occurrences = [...dates]
    .sort((a, b) => b.localeCompare(a))
    .map((dueOn): IncomeHistoryRow => {
      const receipts = receiptsByDate.get(dueOn) ?? []
      const occurrence = {
        due_on: dueOn,
        amount: schedule.amount,
        received_amount:
          receipts.reduce(
            (total, row) => total + Math.round(row.amount * 100),
            0
          ) / 100
      }
      const remaining = occurrenceRemaining(occurrence)
      if (dueOn.startsWith(year)) {
        receivedCents += Math.round(occurrence.received_amount * 100)
      }
      if (dueOn <= today) {
        dueCents += Math.round(remaining * 100)
      }
      return {
        dueOn,
        amount: schedule.amount,
        receivedAmount: occurrence.received_amount,
        remaining,
        status: getIncomeOccurrenceStatus(occurrence, today),
        receipts
      }
    })

  const visible = occurrences.slice(0, Math.max(1, options.limit))
  return {
    occurrences: visible,
    hasMore: occurrences.length > visible.length,
    receivedThisYear: receivedCents / 100,
    dueToDate: dueCents / 100
  }
}
