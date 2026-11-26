import "server-only"
import { NO_ACCOUNT } from "@/features/accounts/constants"
import { TRANSACTION_TYPES } from "@/features/categories/constants"
import { createClient } from "@/libs/supabase/server"
import { ACCOUNT_MOVEMENT_KINDS } from "./constants"
import {
  PAGE_SIZE,
  type TransactionFilters,
  escapeLikePattern,
  filtersDateRange,
  quotePostgrestValue
} from "./filters"
import {
  type ParentLink,
  type TransactionLinks,
  toLedgerEntry
} from "./ledger-entry"
import type {
  EditableTransaction,
  LedgerEntry,
  TransactionTotals
} from "./types"

// PostgREST responde PGRST103 si la página pide un offset mayor que el total
const RANGE_NOT_SATISFIABLE = "PGRST103"

/**
 * Lee la vista ledger_entries para paginar movimientos, traspasos, ajustes y
 * pagos con cuenta juntos, con el orden real (fecha, posición manual del día,
 * captura). Los enlaces a un gasto fijo y a un abono no están en la vista:
 * se piden aparte solo para los movimientos de la página.
 */
export async function getTransactions(
  workspaceId: string,
  filters: TransactionFilters
): Promise<{ rows: LedgerEntry[]; count: number }> {
  const supabase = await createClient()
  const range = filtersDateRange(filters)
  const from = (filters.page - 1) * PAGE_SIZE

  function filtered(head: boolean) {
    let query = supabase
      .from("ledger_entries")
      .select(
        "id, kind, workspace_id, account_id, to_account_id, amount, category_id, description, note, counterparty, invoice_ref, occurred_on, occurred_time, day_position, created_at",
        { count: "exact", head }
      )
      .eq("workspace_id", workspaceId)

    if (range) {
      query = query.gte("occurred_on", range.from).lte("occurred_on", range.to)
    }
    if (filters.type === "transfer") {
      query = query.in("kind", [
        "transfer",
        "adjustment",
        ...ACCOUNT_MOVEMENT_KINDS
      ])
    } else if (filters.type) {
      query = query.eq("kind", filters.type)
    }
    // Traspasos y ajustes no tienen categoría: el filtro los excluye
    if (filters.categoryId) {
      query = query.eq("category_id", filters.categoryId)
    }
    if (filters.accountId === NO_ACCOUNT) {
      query = query.is("account_id", null).in("kind", [...TRANSACTION_TYPES])
    } else if (filters.accountId) {
      // Cuenta del movimiento o del ajuste, u origen o destino del traspaso
      query = query.or(
        `account_id.eq.${filters.accountId},to_account_id.eq.${filters.accountId}`
      )
    }
    if (filters.q) {
      const pattern = quotePostgrestValue(`%${escapeLikePattern(filters.q)}%`)
      // Contraparte y factura solo tienen valor en Empresa
      query = query.or(
        [
          `description.ilike.${pattern}`,
          `note.ilike.${pattern}`,
          `counterparty.ilike.${pattern}`,
          `invoice_ref.ilike.${pattern}`
        ].join(",")
      )
    }
    return query
  }

  const { data, count, error } = await filtered(false)
    .order("occurred_on", { ascending: false })
    .order("day_position", { ascending: true })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + PAGE_SIZE - 1)

  // Página fuera de rango: sin filas, pero con el total real para paginar
  if (error?.code === RANGE_NOT_SATISFIABLE) {
    const { count: total, error: countError } = await filtered(true)
    if (!countError) {
      return { rows: [], count: total ?? 0 }
    }
  }
  if (error) {
    throw new Error("No se pudieron cargar los movimientos")
  }

  const idsOf = (kinds: readonly string[]) =>
    data
      .filter((row) => kinds.includes(row.kind as string))
      .map((row) => row.id as string)

  const [links, debtParents, goalParents] = await Promise.all([
    getTransactionLinks(idsOf(TRANSACTION_TYPES)),
    getParentIds("debt_entries", idsOf(["debt_payment", "debt_advance"])),
    getParentIds("goal_contributions", idsOf(["goal_contribution"]))
  ])
  const parents = new Map([...debtParents, ...goalParents])

  return {
    rows: data.map((row) => toLedgerEntry(row, links, parents)),
    count: count ?? 0
  }
}

// Gasto fijo y abono enlazados a los movimientos de la página
async function getTransactionLinks(ids: string[]) {
  const links = new Map<string, TransactionLinks>()
  if (ids.length === 0) {
    return links
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, recurring_expense_id, recurring_income_id, recurring_income_allocations(due_on, amount), debt_entries(id, debt_id, workspace_id, kind, amount, occurred_on, occurred_time, note, transaction_id, is_extra_payment, debts(kind, status, schedule))"
    )
    .in("id", ids)

  if (error) {
    throw new Error("No se pudieron cargar los movimientos")
  }
  for (const link of data) {
    // transaction_id es único: a lo sumo un abono por movimiento
    const entry = link.debt_entries
    links.set(link.id, {
      recurringExpenseId: link.recurring_expense_id,
      recurringIncomeId: link.recurring_income_id,
      recurringIncomeAllocations: link.recurring_income_allocations
        .map((allocation) => ({
          due_on: allocation.due_on,
          amount: Number(allocation.amount)
        }))
        .sort((a, b) => a.due_on.localeCompare(b.due_on)),
      debtEntry: entry
        ? {
            id: entry.id,
            debt_id: entry.debt_id,
            workspace_id: entry.workspace_id,
            kind: entry.kind,
            amount: Number(entry.amount),
            occurred_on: entry.occurred_on,
            occurred_time: entry.occurred_time,
            note: entry.note,
            transaction_id: entry.transaction_id,
            is_extra_payment: entry.is_extra_payment,
            debt_kind: entry.debts.kind,
            debt_status: entry.debts.status,
            debt_schedule: entry.debts.schedule
          }
        : null
    })
  }
  return links
}

// Deuda o meta de los pagos, avances y aportes de la página: id → padre
async function getParentIds(
  table: "debt_entries" | "goal_contributions",
  ids: string[]
) {
  const parents = new Map<string, ParentLink>()
  if (ids.length === 0) {
    return parents
  }

  const supabase = await createClient()
  if (table === "debt_entries") {
    const { data, error } = await supabase
      .from("debt_entries")
      .select(
        "id, parent_id:debt_id, is_extra_payment, debt:debts!debt_entries_debt_id_workspace_id_fkey (status)"
      )
      .in("id", ids)

    if (error) {
      throw new Error("No se pudieron cargar los movimientos")
    }
    for (const row of data) {
      parents.set(row.id, {
        parentId: row.parent_id,
        isExtraPayment: row.is_extra_payment,
        isActive: row.debt?.status === "active"
      })
    }
    return parents
  }

  const { data, error } = await supabase
    .from("goal_contributions")
    .select(
      "id, parent_id:goal_id, goal:savings_goals!goal_contributions_goal_id_workspace_id_fkey (status)"
    )
    .in("id", ids)

  if (error) {
    throw new Error("No se pudieron cargar los movimientos")
  }
  for (const row of data) {
    parents.set(row.id, {
      parentId: row.parent_id,
      isExtraPayment: false,
      isActive: row.goal?.status === "active"
    })
  }
  return parents
}

/**
 * Un movimiento del espacio listo para el diálogo de edición, o null si no
 * existe o es ajeno (RLS). Lo usan los Sheets de gastos e ingresos fijos para
 * editar un pago ya registrado (SPEC 42)
 */
export async function getEditableTransaction(
  workspaceId: string,
  id: string
): Promise<EditableTransaction | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, type, amount, occurred_on, occurred_time, category_id, description, note, account_id, counterparty, invoice_ref, recurring_expense_id, recurring_income_id, recurring_income_allocations (due_on, amount)"
    )
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  if (error) {
    throw new Error("No se pudo cargar el movimiento")
  }
  if (!data) {
    return null
  }
  return {
    ...data,
    amount: Number(data.amount),
    recurring_income_allocations: data.recurring_income_allocations.map(
      (allocation) => ({
        due_on: allocation.due_on,
        amount: Number(allocation.amount)
      })
    )
  }
}

/** Para distinguir "sin movimientos" de "sin resultados para los filtros" */
export async function hasAnyTransactions(workspaceId: string) {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .limit(1)

  if (error) {
    throw new Error("No se pudieron cargar los movimientos")
  }
  return (count ?? 0) > 0
}

/** Igual que hasAnyTransactions, contando también traspasos y ajustes */
export async function hasAnyLedgerEntries(workspaceId: string) {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("ledger_entries")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .limit(1)

  if (error) {
    throw new Error("No se pudieron cargar los movimientos")
  }
  return (count ?? 0) > 0
}

/**
 * Totales de todo el periodo filtrado, no solo de la página actual. Solo
 * suman ingresos y gastos: traspasos y ajustes no cuentan.
 */
export async function getTransactionTotals(
  workspaceId: string,
  filters: TransactionFilters
): Promise<TransactionTotals> {
  // El filtro "Traspasos" no muestra ingresos ni gastos
  if (filters.type === "transfer") {
    return { income: 0, expense: 0, balance: 0 }
  }

  const supabase = await createClient()
  const range = filtersDateRange(filters)
  const withoutAccount = filters.accountId === NO_ACCOUNT

  const { data, error } = await supabase
    .rpc("transaction_totals", {
      p_workspace_id: workspaceId,
      p_from: range?.from,
      p_to: range?.to,
      p_type: filters.type,
      p_category_id: filters.categoryId,
      p_search: filters.q,
      p_account_id: withoutAccount ? undefined : filters.accountId,
      p_without_account: withoutAccount
    })
    .single()

  if (error) {
    throw new Error("No se pudieron calcular los totales")
  }

  const income = Number(data.income)
  const expense = Number(data.expense)
  return { income, expense, balance: income - expense }
}
