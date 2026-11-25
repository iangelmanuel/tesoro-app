import "server-only"
import type { TransactionType } from "@/features/transactions/filters"
import type { TransactionWithCategory } from "@/features/transactions/types"
import { createClient } from "@/libs/supabase/server"
import {
  type PeriodComparison,
  type PeriodTotals,
  previousPeriod,
  sumPeriodTotals,
  withPrevious
} from "./comparison"

// Todas las agregaciones corren en Postgres (RPC security invoker, con RLS).
// `numeric` puede llegar como string: se convierte con Number() aquí.

/** Una fila de `monthly_totals` */
export interface MonthlyTotal {
  /** Primer día del mes (YYYY-MM-DD) */
  month: string
  income: number
  expense: number
  balance: number
  txCount: number
}

/** Una fila de `category_totals` */
export interface CategoryTotal {
  categoryId: string
  name: string
  icon: string
  color: string
  archived: boolean
  total: number
  txCount: number
}

/** Totales por mes entre `from` y `to`, con los meses vacíos en cero */
export async function getMonthlyTotals(
  workspaceId: string,
  from: string,
  to: string
): Promise<MonthlyTotal[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("monthly_totals", {
    p_workspace_id: workspaceId,
    p_from: from,
    p_to: to
  })

  if (error) {
    throw new Error("No se pudieron calcular los totales por mes")
  }

  return data.map((row) => {
    const income = Number(row.income)
    const expense = Number(row.expense)
    return {
      month: row.month,
      income,
      expense,
      balance: income - expense,
      txCount: Number(row.tx_count)
    }
  })
}

/** Totales por categoría de un tipo, ordenados por total descendente */
export async function getCategoryTotals(
  workspaceId: string,
  from: string,
  to: string,
  type: TransactionType
): Promise<CategoryTotal[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("category_totals", {
    p_workspace_id: workspaceId,
    p_from: from,
    p_to: to,
    p_type: type
  })

  if (error) {
    throw new Error("No se pudieron calcular los totales por categoría")
  }

  return data.map((row) => ({
    categoryId: row.category_id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    archived: row.archived,
    total: Number(row.total),
    txCount: Number(row.tx_count)
  }))
}

/** Balance acumulado histórico del espacio */
export async function getWorkspaceBalance(workspaceId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("workspace_balance", {
    p_workspace_id: workspaceId
  })

  if (error) {
    throw new Error("No se pudo calcular el balance acumulado")
  }

  return Number(data)
}

/** Últimos movimientos del espacio, del más reciente al más antiguo */
export async function getRecentTransactions(
  workspaceId: string,
  limit: number
): Promise<TransactionWithCategory[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("transactions")
    .select("*, category:categories!inner (id, name, icon, color, archived_at)")
    .eq("workspace_id", workspaceId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error("No se pudieron cargar los últimos movimientos")
  }

  return data
}

// monthly_totals agrupa por mes completo; category_totals filtra por día
// exacto. Un rango que no cae en meses completos se suma desde categorías
async function rangeTotals(
  workspaceId: string,
  from: string,
  to: string
): Promise<PeriodTotals> {
  const [income, expense] = await Promise.all([
    getCategoryTotals(workspaceId, from, to, "income"),
    getCategoryTotals(workspaceId, from, to, "expense")
  ])
  const incomeTotal = income.reduce((total, row) => total + row.total, 0)
  const expenseTotal = expense.reduce((total, row) => total + row.total, 0)

  return {
    income: incomeTotal,
    expense: expenseTotal,
    balance: incomeTotal - expenseTotal,
    txCount: [...income, ...expense].reduce(
      (total, row) => total + row.txCount,
      0
    )
  }
}

/**
 * Totales del periodo [from, to] y del anterior de la misma duración
 * (`previousPeriod`). Con meses completos es una sola llamada. Solo reusa
 * las RPC existentes: sin esquema nuevo.
 */
export async function getPeriodComparison(
  workspaceId: string,
  from: string,
  to: string
): Promise<PeriodComparison> {
  const previous = previousPeriod(from, to)

  if (previous.months !== null) {
    const rows = await getMonthlyTotals(workspaceId, previous.from, to)
    return withPrevious(
      sumPeriodTotals(rows.filter((row) => row.month >= from)),
      sumPeriodTotals(rows.filter((row) => row.month < from))
    )
  }

  const [currentTotals, previousTotals] = await Promise.all([
    rangeTotals(workspaceId, from, to),
    rangeTotals(workspaceId, previous.from, previous.to)
  ])
  return withPrevious(currentTotals, previousTotals)
}
