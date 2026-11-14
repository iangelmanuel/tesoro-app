import { type Debt, getDebts } from "@/features/debts/queries"
import {
  INSTALLMENT_STATUS,
  type Installment,
  receivableInstallments
} from "@/features/debts/receivable-schedule"
import {
  OCCURRENCE_STATUS,
  getOccurrenceStatus
} from "@/features/recurring-expenses/occurrences"
import {
  INCOME_OCCURRENCE_STATUS,
  getIncomeOccurrenceStatus
} from "@/features/recurring-incomes/occurrences"
import type { Workspace } from "@/features/workspaces/queries"
import { monthRange, todayISO } from "@/libs/dates"
import { createClient } from "@/libs/supabase/server"
import type {
  BusinessMonthData,
  ExportAccountRow,
  ExportMovementKind,
  ExportMovementRow,
  ExportRange,
  PersonalMonthData
} from "./types"

// Todo lo que lee la exportación, con la sesión del usuario y RLS. Las
// consultas cubren el rango completo (no una por mes) y paginan de 1000 en
// 1000, el tope de filas por respuesta de Supabase.

const PAGE_SIZE = 1000

type Supabase = Awaited<ReturnType<typeof createClient>>

interface PageResult<T> {
  data: T[] | null
  error: unknown
}

/** Todas las filas de una consulta, pidiéndolas por páginas de 1000 */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  message: string
): Promise<T[]> {
  const rows: T[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error || !data) {
      throw new Error(message)
    }
    rows.push(...data)
    if (data.length < PAGE_SIZE) {
      return rows
    }
  }
}

const roundCents = (value: number) => Math.round(value * 100) / 100

const sum = (values: number[]) => roundCents(values.reduce((a, b) => a + b, 0))

/** Fecha YYYY-MM-DD en America/Bogota de un timestamp */
const dateOf = (timestamp: string) => todayISO(new Date(timestamp))

/** "HH:MM:SS" de Postgres → "HH:MM" */
const shortTime = (time: string | null) => (time ? time.slice(0, 5) : null)

/** Día anterior a una fecha YYYY-MM-DD */
function previousDay(date: string) {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10)
}

/**
 * Límites de fecha de la exportación: del primer día del primer mes al último
 * día del último, o a hoy si el último mes es el actual (el mes en curso se
 * exporta hasta hoy)
 */
export function exportBounds(range: ExportRange, today: string) {
  const last = monthRange(range.to).to
  return { from: monthRange(range.from).from, to: last < today ? last : today }
}

/** Primer y último día de un mes del rango, cortado en `bounds.to` */
function monthBounds(month: string, bounds: { to: string }) {
  const { from, to } = monthRange(month)
  return { from, to: to < bounds.to ? to : bounds.to }
}

/** Mes YYYY-MM del primer movimiento o traspaso del espacio, o null */
export async function getExportHistoryStart(workspaceId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("occurred_on")
    .eq("workspace_id", workspaceId)
    .in("kind", ["income", "expense", "transfer"])
    .order("occurred_on", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error("No se pudo leer el historial")
  }
  return data?.occurred_on ? data.occurred_on.slice(0, 7) : null
}

// ─── Lecturas comunes ─────────────────────────────────────────────────────────

interface Names {
  categories: Map<string, string>
  accounts: Map<string, string>
}

/** Nombres de categorías (del sistema y propias) y cuentas del espacio */
async function loadNames(supabase: Supabase, workspace: Workspace) {
  const [categories, accounts] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name")
      .eq("scope", workspace.type)
      .or(`workspace_id.is.null,workspace_id.eq.${workspace.id}`),
    supabase
      .from("accounts")
      .select("id, name")
      .eq("workspace_id", workspace.id)
  ])

  if (categories.error || accounts.error) {
    throw new Error("No se pudieron cargar las categorías y cuentas")
  }

  return {
    categories: new Map(categories.data.map((row) => [row.id, row.name])),
    accounts: new Map(accounts.data.map((row) => [row.id, row.name]))
  } satisfies Names
}

const KIND_LABELS: Record<
  Workspace["type"],
  Record<"income" | "expense" | "transfer", ExportMovementKind>
> = {
  personal: { income: "Ingreso", expense: "Gasto", transfer: "Traspaso" },
  business: { income: "Venta", expense: "Costo o gasto", transfer: "Traspaso" }
}

interface LoadedMovement extends ExportMovementRow {
  id: string
  source: "income" | "expense" | "transfer"
}

/**
 * Movimientos y traspasos del rango, en el orden de Movimientos dentro de
 * cada día (posición manual y captura), con las fechas de forma ascendente.
 * Ajustes, pagos de tarjeta y aportes a metas no son ingreso ni gasto y no
 * van en la exportación de movimientos.
 */
async function loadMovements(
  supabase: Supabase,
  workspace: Workspace,
  bounds: { from: string; to: string },
  names: Names
): Promise<LoadedMovement[]> {
  const rows = await fetchAll(
    (from, to) =>
      supabase
        .from("ledger_entries")
        .select(
          "id, kind, amount, occurred_on, occurred_time, account_id, to_account_id, category_id, description, note, counterparty, invoice_ref"
        )
        .eq("workspace_id", workspace.id)
        .in("kind", ["income", "expense", "transfer"])
        .gte("occurred_on", bounds.from)
        .lte("occurred_on", bounds.to)
        .order("occurred_on", { ascending: true })
        .order("day_position", { ascending: true })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    "No se pudieron cargar los movimientos"
  )

  const labels = KIND_LABELS[workspace.type]
  const isBusiness = workspace.type === "business"

  return rows.map((row) => {
    const source = row.kind as LoadedMovement["source"]
    const date = row.occurred_on as string
    const accountId = row.account_id
    const isTransfer = source === "transfer"

    return {
      id: row.id as string,
      source,
      month: date.slice(0, 7),
      date,
      time: shortTime(row.occurred_time),
      kind: labels[source],
      description: isTransfer ? "Traspaso" : (row.description ?? ""),
      category: row.category_id
        ? (names.categories.get(row.category_id) ?? null)
        : null,
      account: accountId ? (names.accounts.get(accountId) ?? null) : null,
      destination:
        isTransfer && row.to_account_id
          ? (names.accounts.get(row.to_account_id) ?? null)
          : null,
      note: row.note,
      amount: Number(row.amount),
      ...(isBusiness
        ? { counterparty: row.counterparty, invoiceRef: row.invoice_ref }
        : {})
    }
  })
}

/** Quita los campos internos antes de entregar la fila */
function toRow(movement: LoadedMovement): ExportMovementRow {
  const { counterparty, invoiceRef } = movement
  return {
    month: movement.month,
    date: movement.date,
    time: movement.time,
    kind: movement.kind,
    description: movement.description,
    category: movement.category,
    account: movement.account,
    destination: movement.destination,
    note: movement.note,
    amount: movement.amount,
    ...(counterparty !== undefined ? { counterparty, invoiceRef } : {})
  }
}

/** Saldos por cuenta de cada mes: mes YYYY-MM → filas */
async function loadAccountBalances(
  supabase: Supabase,
  workspaceId: string,
  bounds: { from: string; to: string },
  names: Names
) {
  const { data, error } = await supabase.rpc("account_balances_by_month", {
    p_workspace_id: workspaceId,
    p_from: bounds.from,
    p_to: bounds.to
  })

  if (error) {
    throw new Error("No se pudieron calcular los saldos por cuenta")
  }

  const byMonth = new Map<string, ExportAccountRow[]>()
  for (const row of data) {
    const month = row.month.slice(0, 7)
    const list = byMonth.get(month) ?? []
    list.push({
      name: names.accounts.get(row.account_id) ?? "Cuenta",
      opening: Number(row.opening),
      inflow: Number(row.inflow),
      outflow: Number(row.outflow),
      closing: Number(row.closing)
    })
    byMonth.set(month, list)
  }
  return byMonth
}

function groupByMonth<T extends { month: string }>(rows: T[]) {
  const byMonth = new Map<string, T[]>()
  for (const row of rows) {
    const list = byMonth.get(row.month) ?? []
    list.push(row)
    byMonth.set(row.month, list)
  }
  return byMonth
}

// ─── Personal ─────────────────────────────────────────────────────────────────

async function loadRecurringIncomes(
  supabase: Supabase,
  workspaceId: string,
  range: ExportRange,
  bounds: { from: string; to: string },
  names: Names,
  movements: LoadedMovement[],
  today: string
) {
  const [occurrences, sources] = await Promise.all([
    supabase.rpc("recurring_income_occurrences", {
      p_workspace_id: workspaceId,
      p_from: bounds.from,
      p_to: bounds.to
    }),
    supabase
      .from("recurring_incomes")
      .select(
        "id, name, amount, category_id, account_id, frequency, starts_on, ends_on, is_active"
      )
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true })
  ])

  if (occurrences.error || sources.error) {
    throw new Error("No se pudieron cargar los ingresos fijos")
  }

  // Un ingreso puede cubrir varias ocurrencias y una ocurrencia recibir
  // varios ingresos (SPEC 38): la cuenta sale de los movimientos asignados
  const allocations = await fetchAll(
    (from, to) =>
      supabase
        .from("recurring_income_allocations")
        .select("id, recurring_income_id, due_on, transaction_id")
        .eq("workspace_id", workspaceId)
        .gte("due_on", bounds.from)
        .lte("due_on", bounds.to)
        .order("id", { ascending: true })
        .range(from, to),
    "No se pudieron cargar los ingresos fijos"
  )
  const accountByTransaction = new Map(
    movements.map((row) => [row.id, row.account])
  )
  const accountsByOccurrence = new Map<string, Set<string>>()
  for (const row of allocations) {
    const account = accountByTransaction.get(row.transaction_id)
    if (!account) continue
    const key = `${row.recurring_income_id}:${row.due_on}`
    const set = accountsByOccurrence.get(key) ?? new Set<string>()
    set.add(account)
    accountsByOccurrence.set(key, set)
  }
  const byMonth = new Map<string, PersonalMonthData["recurringIncomes"]>()
  const push = (
    month: string,
    row: PersonalMonthData["recurringIncomes"][number]
  ) => {
    const list = byMonth.get(month) ?? []
    list.push(row)
    byMonth.set(month, list)
  }

  for (const row of occurrences.data) {
    const occurrence = {
      due_on: row.due_on,
      amount: Number(row.amount),
      received_amount: Number(row.received_amount)
    }
    const received = accountsByOccurrence.get(
      `${row.recurring_income_id}:${row.due_on}`
    )
    const account = received
      ? [...received].join(", ")
      : row.account_id
        ? (names.accounts.get(row.account_id) ?? null)
        : null

    push(row.due_on.slice(0, 7), {
      name: row.name,
      dueOn: row.due_on,
      category: names.categories.get(row.category_id) ?? "",
      account,
      expected: occurrence.amount,
      received: occurrence.received_amount,
      status:
        INCOME_OCCURRENCE_STATUS[getIncomeOccurrenceStatus(occurrence, today)]
          .label
    })
  }

  // Fuentes sin fecha fija: una fila por mes con lo recibido en el mes
  const noFixedDate = sources.data.filter((row) => row.frequency === "none")
  if (noFixedDate.length > 0) {
    const ids = noFixedDate.map((row) => row.id)
    const received = await fetchAll(
      (from, to) =>
        supabase
          .from("transactions")
          .select("id, recurring_income_id, amount, occurred_on")
          .eq("workspace_id", workspaceId)
          .in("recurring_income_id", ids)
          .gte("occurred_on", bounds.from)
          .lte("occurred_on", bounds.to)
          .order("id", { ascending: true })
          .range(from, to),
      "No se pudieron cargar los ingresos fijos"
    )

    const totals = new Map<string, number>()
    for (const row of received) {
      const key = `${row.recurring_income_id}:${row.occurred_on.slice(0, 7)}`
      totals.set(key, (totals.get(key) ?? 0) + Number(row.amount))
    }

    for (const month of range.months) {
      const { from, to } = monthBounds(month, bounds)
      for (const source of noFixedDate) {
        const amount = roundCents(totals.get(`${source.id}:${month}`) ?? 0)
        const active =
          source.is_active &&
          source.starts_on <= to &&
          (source.ends_on === null || source.ends_on >= from)
        if (!active && amount === 0) continue

        push(month, {
          name: source.name,
          dueOn: null,
          category: names.categories.get(source.category_id) ?? "",
          account: source.account_id
            ? (names.accounts.get(source.account_id) ?? null)
            : null,
          expected: Number(source.amount),
          received: amount,
          status:
            INCOME_OCCURRENCE_STATUS[amount > 0 ? "received" : "pending"].label
        })
      }
    }
  }

  return byMonth
}

async function loadRecurringExpenses(
  supabase: Supabase,
  workspaceId: string,
  bounds: { from: string; to: string },
  names: Names,
  today: string
) {
  const { data, error } = await supabase.rpc("recurring_occurrences", {
    p_workspace_id: workspaceId,
    p_from: bounds.from,
    p_to: bounds.to
  })

  if (error) {
    throw new Error("No se pudieron cargar los gastos fijos")
  }

  return Map.groupBy(
    data.map((row) => ({
      name: row.name,
      dueOn: row.due_on,
      category: names.categories.get(row.category_id) ?? "",
      amount: Number(row.amount),
      paid: row.paid_amount === null ? 0 : Number(row.paid_amount),
      status: OCCURRENCE_STATUS[getOccurrenceStatus(row, today)].label
    })),
    (row) => row.dueOn.slice(0, 7)
  )
}

/** Presupuestos de cada mes (los que tienen límite), con lo gastado */
async function loadBudgets(
  supabase: Supabase,
  workspaceId: string,
  range: ExportRange
) {
  const results = await Promise.all(
    range.months.map((month) =>
      supabase.rpc("budget_progress", {
        p_workspace_id: workspaceId,
        p_month: `${month}-01`
      })
    )
  )

  const byMonth = new Map<string, PersonalMonthData["budgets"]>()
  results.forEach(({ data, error }, index) => {
    if (error) {
      throw new Error("No se pudieron cargar los presupuestos")
    }
    byMonth.set(
      range.months[index],
      data
        .filter((row) => row.budget_id !== null && row.budget_amount !== null)
        .map((row) => ({
          category: row.name,
          limit: Number(row.budget_amount),
          spent: Number(row.spent)
        }))
    )
  })
  return byMonth
}

async function loadGoals(
  supabase: Supabase,
  workspaceId: string,
  range: ExportRange,
  bounds: { from: string; to: string }
) {
  const [goals, contributions] = await Promise.all([
    supabase
      .from("savings_goals")
      .select("id, name, target_amount, status, completed_at, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
    fetchAll(
      (from, to) =>
        supabase
          .from("goal_contributions")
          .select("goal_id, amount, occurred_on")
          .eq("workspace_id", workspaceId)
          .lte("occurred_on", bounds.to)
          .order("id", { ascending: true })
          .range(from, to),
      "No se pudieron cargar los aportes"
    )
  ])

  if (goals.error) {
    throw new Error("No se pudieron cargar las metas")
  }

  const byGoal = Map.groupBy(contributions, (row) => row.goal_id)
  const byMonth = new Map<string, PersonalMonthData["goals"]>()

  for (const month of range.months) {
    const { from, to } = monthBounds(month, bounds)
    const rows: PersonalMonthData["goals"] = []

    for (const goal of goals.data) {
      if (dateOf(goal.created_at) > to) continue

      const entries = byGoal.get(goal.id) ?? []
      const contributed = sum(
        entries
          .filter((row) => row.occurred_on >= from && row.occurred_on <= to)
          .map((row) => Number(row.amount))
      )
      const closedBefore =
        goal.status !== "active" &&
        (goal.completed_at === null || dateOf(goal.completed_at) < from)
      if (closedBefore && contributed === 0) continue

      rows.push({
        name: goal.name,
        contributed,
        savedAtClose: sum(
          entries
            .filter((row) => row.occurred_on <= to)
            .map((row) => Number(row.amount))
        ),
        target: Number(goal.target_amount)
      })
    }
    byMonth.set(month, rows)
  }
  return byMonth
}

interface DebtEntryLite {
  id: string
  debt_id: string
  kind: string
  amount: number
  occurred_on: string
  period_on: string | null
}

/**
 * Saldo de una deuda a una fecha: mismo cálculo que debt_overview (saldo
 * inicial − abonos + ajustes, avances y cuotas de manejo)
 */
function debtBalanceAt(debt: Debt, entries: DebtEntryLite[], on: string) {
  return roundCents(
    entries
      .filter((entry) => entry.occurred_on <= on)
      .reduce(
        (balance, entry) =>
          entry.kind === "payment"
            ? balance - entry.amount
            : balance + entry.amount,
        debt.opening_balance
      )
  )
}

const DEBT_KIND_LABELS = {
  credit_card: "Tarjeta de crédito",
  loan: "Préstamo"
} as const

/** Cerrada (pagada o archivada) antes de empezar el mes */
function closedBefore(debt: Debt, from: string) {
  return (
    debt.status !== "active" &&
    debt.closed_at !== null &&
    dateOf(debt.closed_at) < from
  )
}

async function loadDebts(
  supabase: Supabase,
  workspaceId: string,
  range: ExportRange,
  bounds: { from: string; to: string },
  today: string
) {
  const [debts, entries] = await Promise.all([
    getDebts(workspaceId),
    fetchAll(
      (from, to) =>
        supabase
          .from("debt_entries")
          .select("id, debt_id, kind, amount, occurred_on, period_on")
          .eq("workspace_id", workspaceId)
          .order("id", { ascending: true })
          .range(from, to),
      "No se pudieron cargar los pagos de las deudas"
    )
  ])

  const entriesByDebt = Map.groupBy(
    entries.map((row) => ({ ...row, amount: Number(row.amount) })),
    (row) => row.debt_id
  )

  // Las cuotas de una cuenta por cobrar mensual se calculan una vez con
  // todos sus abonos (estado igual al de la página)
  const installmentsByDebt = new Map<string, Map<string, Installment>>()
  for (const debt of debts) {
    if (debt.kind !== "receivable" || debt.schedule !== "monthly") continue
    const list = receivableInstallments(
      debt,
      entriesByDebt.get(debt.id) ?? [],
      today
    )
    installmentsByDebt.set(
      debt.id,
      new Map(list.map((item) => [item.period_on.slice(0, 7), item]))
    )
  }

  const debtsByMonth = new Map<string, PersonalMonthData["debts"]>()
  const receivablesByMonth = new Map<string, PersonalMonthData["receivables"]>()

  for (const month of range.months) {
    const { from, to } = monthBounds(month, bounds)
    const debtRows: PersonalMonthData["debts"] = []
    const receivableRows: PersonalMonthData["receivables"] = []

    for (const debt of debts) {
      if (dateOf(debt.created_at) > to) continue

      const all = entriesByDebt.get(debt.id) ?? []
      const inMonth = all.filter(
        (entry) => entry.occurred_on >= from && entry.occurred_on <= to
      )
      const payments = sum(
        inMonth
          .filter((entry) => entry.kind === "payment")
          .map((entry) => entry.amount)
      )
      const charges = sum(
        inMonth
          .filter((entry) => entry.kind !== "payment")
          .map((entry) => entry.amount)
      )

      if (debt.kind !== "receivable") {
        const opening = debtBalanceAt(debt, all, previousDay(from))
        const closing = debtBalanceAt(debt, all, to)
        // Sin actividad en el mes: sale si tiene saldo y no se cerró antes
        const idle = payments === 0 && charges === 0
        if (
          idle &&
          (closedBefore(debt, from) || (opening === 0 && closing === 0))
        ) {
          continue
        }

        debtRows.push({
          name: debt.name,
          kind: DEBT_KIND_LABELS[debt.kind],
          payments,
          charges,
          balanceAtClose: closing
        })
        continue
      }

      const row = receivableRow(debt, all, month, from, to, payments, today)
      if (!row) continue
      if (closedBefore(debt, from) && row.collected === 0) continue
      receivableRows.push(row)
    }

    debtsByMonth.set(month, debtRows)
    receivablesByMonth.set(month, receivableRows)
  }

  return { debtsByMonth, receivablesByMonth }

  /**
   * Fila de Me deben de un mes, o null si la cuenta por cobrar no tiene nada
   * esperado, cobrado ni pendiente ese mes
   */
  function receivableRow(
    debt: Debt,
    all: DebtEntryLite[],
    month: string,
    from: string,
    to: string,
    collected: number,
    today: string
  ): PersonalMonthData["receivables"][number] | null {
    if (debt.schedule === "monthly") {
      const installment = installmentsByDebt.get(debt.id)?.get(month) ?? null
      const openEnded = debt.term_months === null

      // Pendiente al cierre con los abonos hechos hasta ese día
      let pendingAtClose: number
      if (openEnded) {
        const upToClose = receivableInstallments(
          debt,
          all.filter((entry) => entry.occurred_on <= to),
          today
        )
        pendingAtClose = sum(
          upToClose
            .filter((item) => item.period_on.slice(0, 7) <= month)
            .map((item) => item.remaining)
        )
      } else {
        pendingAtClose = Math.max(debtBalanceAt(debt, all, to), 0)
      }

      const expected = installment?.expected ?? 0
      if (expected === 0 && collected === 0 && pendingAtClose === 0) {
        return null
      }
      return {
        name: debt.name,
        expected,
        collected,
        pendingAtClose,
        status: installment
          ? INSTALLMENT_STATUS[installment.status].label
          : receivableStatus(debt, today)
      }
    }

    const pendingAtClose = Math.max(debtBalanceAt(debt, all, to), 0)
    const expectedThisMonth =
      debt.expected_on !== null &&
      debt.expected_on >= from &&
      debt.expected_on <= monthRange(month).to
    const expected = expectedThisMonth
      ? Math.max(debtBalanceAt(debt, all, previousDay(from)), 0)
      : 0

    if (expected === 0 && collected === 0 && pendingAtClose === 0) {
      return null
    }
    return {
      name: debt.name,
      expected,
      collected,
      pendingAtClose,
      status: receivableStatus(debt, today)
    }
  }
}

/** Estado de una cuenta por cobrar de pago único, igual que en Deudas */
function receivableStatus(debt: Debt, today: string) {
  if (debt.status === "paid" || debt.balance <= 0) return "Cobrada"
  if (debt.status === "archived") return "Archivada"
  if (debt.expected_on !== null && debt.expected_on < today) return "Atrasada"
  return "Pendiente"
}

export interface PersonalExport {
  type: "personal"
  months: PersonalMonthData[]
  movements: ExportMovementRow[]
}

export interface BusinessExport {
  type: "business"
  months: BusinessMonthData[]
  movements: ExportMovementRow[]
}

export type ExportData = PersonalExport | BusinessExport

function summaryBalances(accounts: ExportAccountRow[]) {
  return {
    openingBalance: sum(accounts.map((row) => row.opening)),
    closingBalance: sum(accounts.map((row) => row.closing))
  }
}

async function loadPersonal(
  supabase: Supabase,
  workspace: Workspace,
  range: ExportRange,
  today: string
): Promise<PersonalExport> {
  const bounds = exportBounds(range, today)
  const names = await loadNames(supabase, workspace)
  const movements = await loadMovements(supabase, workspace, bounds, names)

  const [accounts, incomes, expenses, budgets, goals, debts] =
    await Promise.all([
      loadAccountBalances(supabase, workspace.id, bounds, names),
      loadRecurringIncomes(
        supabase,
        workspace.id,
        range,
        bounds,
        names,
        movements,
        today
      ),
      loadRecurringExpenses(supabase, workspace.id, bounds, names, today),
      loadBudgets(supabase, workspace.id, range),
      loadGoals(supabase, workspace.id, range, bounds),
      loadDebts(supabase, workspace.id, range, bounds, today)
    ])

  const movementsByMonth = groupByMonth(movements)

  return {
    type: "personal",
    movements: movements.map(toRow),
    months: range.months.map((month) => {
      const rows = movementsByMonth.get(month) ?? []
      const monthAccounts = accounts.get(month) ?? []
      return {
        month,
        summary: {
          income: sum(
            rows.filter((r) => r.source === "income").map((r) => r.amount)
          ),
          expense: sum(
            rows.filter((r) => r.source === "expense").map((r) => r.amount)
          ),
          ...summaryBalances(monthAccounts)
        },
        accounts: monthAccounts,
        recurringIncomes: incomes.get(month) ?? [],
        recurringExpenses: expenses.get(month) ?? [],
        budgets: budgets.get(month) ?? [],
        goals: goals.get(month) ?? [],
        debts: debts.debtsByMonth.get(month) ?? [],
        receivables: debts.receivablesByMonth.get(month) ?? [],
        movements: rows.map(toRow)
      }
    })
  }
}

// ─── Empresa ──────────────────────────────────────────────────────────────────

async function loadBusiness(
  supabase: Supabase,
  workspace: Workspace,
  range: ExportRange,
  today: string
): Promise<BusinessExport> {
  const bounds = exportBounds(range, today)
  const names = await loadNames(supabase, workspace)
  const [movements, accounts] = await Promise.all([
    loadMovements(supabase, workspace, bounds, names),
    loadAccountBalances(supabase, workspace.id, bounds, names)
  ])
  const movementsByMonth = groupByMonth(movements)

  return {
    type: "business",
    movements: movements.map(toRow),
    months: range.months.map((month) => {
      const rows = movementsByMonth.get(month) ?? []
      const sales = rows.filter((row) => row.source === "income")
      const costs = rows.filter((row) => row.source === "expense")
      const monthAccounts = accounts.get(month) ?? []

      const byCategory = new Map<string, number>()
      for (const row of costs) {
        const category = row.category ?? "Sin categoría"
        byCategory.set(category, (byCategory.get(category) ?? 0) + row.amount)
      }

      return {
        month,
        summary: {
          sales: sum(sales.map((row) => row.amount)),
          costs: sum(costs.map((row) => row.amount)),
          ...summaryBalances(monthAccounts)
        },
        accounts: monthAccounts,
        costsByCategory: [...byCategory]
          .map(([category, total]) => ({ category, total: roundCents(total) }))
          .sort((a, b) => b.total - a.total),
        sales: sales.map(toRow),
        costs: costs.map(toRow),
        transfers: rows.filter((row) => row.source === "transfer").map(toRow)
      }
    })
  }
}

/** Datos de la exportación de un espacio ya validado como del usuario */
export async function loadExportData(
  workspace: Workspace,
  range: ExportRange,
  today: string
): Promise<ExportData> {
  const supabase = await createClient()
  return workspace.type === "personal"
    ? loadPersonal(supabase, workspace, range, today)
    : loadBusiness(supabase, workspace, range, today)
}
