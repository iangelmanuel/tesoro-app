import "server-only"
import {
  OCCURRENCE_STATUS,
  getOccurrenceStatus
} from "@/features/recurring-expenses/occurrences"
import {
  INCOME_OCCURRENCE_STATUS,
  getIncomeOccurrenceStatus
} from "@/features/recurring-incomes/occurrences"
import type { Workspace } from "@/features/workspaces/queries"
import { roundCents } from "@/libs/money"
import { loadDebts } from "./debt-export-queries"
import {
  type LoadedMovement,
  dateOf,
  exportBounds,
  groupByMonth,
  monthBounds,
  sumCents,
  summaryBalances,
  toRow
} from "./export-calculations"
import {
  type Names,
  type Supabase,
  fetchAll,
  loadAccountBalances,
  loadMovements,
  loadNames
} from "./movement-export-queries"
import type { ExportRange, PersonalExport, PersonalMonthData } from "./types"

/** Ingresos fijos de cada mes, con lo esperado y lo recibido */
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

/** Gastos fijos de cada mes, con lo pagado y su estado */
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

/** Metas de cada mes: aportado en el mes y ahorrado al cierre */
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
      const contributed = sumCents(
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
        savedAtClose: sumCents(
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

/** Hojas de mes y Movimientos de Personal */
export async function loadPersonalExport(
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
          income: sumCents(
            rows.filter((r) => r.source === "income").map((r) => r.amount)
          ),
          expense: sumCents(
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
