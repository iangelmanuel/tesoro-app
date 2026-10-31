import { NO_ACCOUNT } from "@/features/accounts/constants"
import { TRANSACTION_TYPES } from "@/features/categories/constants"
import { createClient } from "@/libs/supabase/server"
import type { Database } from "@/types/database"
import {
  PAGE_SIZE,
  type TransactionFilters,
  type TransactionType,
  escapeLikePattern,
  filtersDateRange
} from "./filters"

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"]
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"]
type LedgerEntryRow = Database["public"]["Views"]["ledger_entries"]["Row"]

export type TransactionWithCategory = TransactionRow & {
  category: Pick<CategoryRow, "id" | "name" | "icon" | "color" | "archived_at">
}

/** Campos de un movimiento que usa el diálogo de edición */
export type EditableTransaction = Pick<
  TransactionRow,
  | "id"
  | "type"
  | "amount"
  | "occurred_on"
  | "category_id"
  | "description"
  | "note"
  | "account_id"
  | "counterparty"
  | "invoice_ref"
  | "recurring_expense_id"
>

/**
 * Fila de Movimientos: un ingreso o gasto, un traspaso o un ajuste de saldo.
 * La categoría y la cuenta se resuelven en la tabla con las listas que la
 * página ya carga.
 */
export type LedgerEntry =
  | {
      kind: TransactionType
      transaction: EditableTransaction
    }
  | {
      kind: "transfer"
      id: string
      amount: number
      occurred_on: string
      note: string | null
      from_account_id: string
      to_account_id: string
    }
  | {
      kind: "adjustment"
      id: string
      /** > 0 sube el saldo */
      amount: number
      occurred_on: string
      note: string | null
      account_id: string
    }

export interface TransactionTotals {
  income: number
  expense: number
  balance: number
}

// Valor entre comillas para un filtro `or` de PostgREST: escapa `\` y `"`
function quotePostgrestValue(value: string) {
  return `"${value.replace(/[\\"]/g, (match) => `\\${match}`)}"`
}

// PostgREST responde PGRST103 si la página pide un offset mayor que el total
const RANGE_NOT_SATISFIABLE = "PGRST103"

// Lee la vista ledger_entries para paginar movimientos, traspasos y ajustes
// juntos, con el orden real. El enlace a un gasto fijo no está en la vista:
// se pide aparte solo para los movimientos de la página.
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
      .select("*", { count: "exact", head })
      .eq("workspace_id", workspaceId)

    if (range) {
      query = query.gte("occurred_on", range.from).lte("occurred_on", range.to)
    }
    if (filters.type === "transfer") {
      query = query.in("kind", ["transfer", "adjustment"])
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
    .order("created_at", { ascending: false })
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

  const transactionIds = data
    .filter((row) => row.kind === "income" || row.kind === "expense")
    .map((row) => row.id as string)
  const recurringIds = new Map<string, string | null>()

  if (transactionIds.length > 0) {
    const { data: links, error: linksError } = await supabase
      .from("transactions")
      .select("id, recurring_expense_id")
      .in("id", transactionIds)

    if (linksError) {
      throw new Error("No se pudieron cargar los movimientos")
    }
    for (const link of links) {
      recurringIds.set(link.id, link.recurring_expense_id)
    }
  }

  return {
    rows: data.map((row) => toLedgerEntry(row, recurringIds)),
    count: count ?? 0
  }
}

// Las columnas de una vista llegan como nullable en los tipos generados
function toLedgerEntry(
  row: LedgerEntryRow,
  recurringIds: Map<string, string | null>
): LedgerEntry {
  const id = row.id as string
  const amount = Number(row.amount)
  const occurred_on = row.occurred_on as string

  if (row.kind === "transfer") {
    return {
      kind: "transfer",
      id,
      amount,
      occurred_on,
      note: row.note,
      from_account_id: row.account_id as string,
      to_account_id: row.to_account_id as string
    }
  }
  if (row.kind === "adjustment") {
    return {
      kind: "adjustment",
      id,
      amount,
      occurred_on,
      note: row.note,
      account_id: row.account_id as string
    }
  }

  const type = row.kind as TransactionType
  return {
    kind: type,
    transaction: {
      id,
      type,
      amount,
      occurred_on,
      category_id: row.category_id as string,
      description: row.description as string,
      note: row.note,
      account_id: row.account_id,
      counterparty: row.counterparty,
      invoice_ref: row.invoice_ref,
      recurring_expense_id: recurringIds.get(id) ?? null
    }
  }
}

// Para distinguir "sin movimientos" de "sin resultados para los filtros"
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

// Igual que hasAnyTransactions, contando también traspasos y ajustes
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

// Totales de todo el periodo filtrado, no solo de la página actual. Solo
// suman ingresos y gastos: traspasos y ajustes no cuentan.
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
