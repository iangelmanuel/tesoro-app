import { createClient } from "@/libs/supabase/server"
import type { Database } from "@/types/database"
import {
  PAGE_SIZE,
  type TransactionFilters,
  escapeLikePattern,
  filtersDateRange
} from "./filters"

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"]
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"]

export type TransactionWithCategory = TransactionRow & {
  category: Pick<CategoryRow, "id" | "name" | "icon" | "color" | "archived_at">
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

export async function getTransactions(
  workspaceId: string,
  filters: TransactionFilters
): Promise<{ rows: TransactionWithCategory[]; count: number }> {
  const supabase = await createClient()
  const range = filtersDateRange(filters)
  const from = (filters.page - 1) * PAGE_SIZE

  function filtered(head: boolean) {
    let query = supabase
      .from("transactions")
      .select(
        "*, category:categories!inner (id, name, icon, color, archived_at)",
        { count: "exact", head }
      )
      .eq("workspace_id", workspaceId)

    if (range) {
      query = query.gte("occurred_on", range.from).lte("occurred_on", range.to)
    }
    if (filters.type) {
      query = query.eq("type", filters.type)
    }
    if (filters.categoryId) {
      query = query.eq("category_id", filters.categoryId)
    }
    if (filters.q) {
      const pattern = quotePostgrestValue(`%${escapeLikePattern(filters.q)}%`)
      query = query.or(`description.ilike.${pattern},note.ilike.${pattern}`)
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

  return { rows: data, count: count ?? 0 }
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

// Totales de todo el periodo filtrado, no solo de la página actual
export async function getTransactionTotals(
  workspaceId: string,
  filters: TransactionFilters
): Promise<TransactionTotals> {
  const supabase = await createClient()
  const range = filtersDateRange(filters)

  const { data, error } = await supabase
    .rpc("transaction_totals", {
      p_workspace_id: workspaceId,
      p_from: range?.from,
      p_to: range?.to,
      p_type: filters.type,
      p_category_id: filters.categoryId,
      p_search: filters.q
    })
    .single()

  if (error) {
    throw new Error("No se pudieron calcular los totales")
  }

  const income = Number(data.income)
  const expense = Number(data.expense)
  return { income, expense, balance: income - expense }
}
