import { getCategoryTotals, getMonthlyTotals } from "@/features/reports/queries"
import { historyMonths, monthsBetween } from "@/features/score/curves"
import { getFirstTransactionOn } from "@/features/score/queries"
import type { TransactionType } from "@/features/transactions/filters"
import { monthRange, shiftMonth, todayISO } from "@/libs/dates"
import { createClient } from "@/libs/supabase/server"
import { businessInputsStart, businessScoreHistory } from "./calculations"
import { COST_GROWTH_BASE_MONTHS } from "./constants"
import type {
  BusinessMonthlyInput,
  BusinessScoreInputs,
  CategoryCost
} from "./types"

// Las sumas corren en Postgres (RPC security invoker, con RLS) y el score se
// calcula en TS. `numeric` puede llegar como string: se convierte con
// Number() aquí.

/**
 * Meses antes de `from` con costos por categoría: la ventana mira 2 y la
 * regla cost_growth, el último mes cerrado y los 3 anteriores
 */
const CATEGORY_LOOKBACK_MONTHS = COST_GROWTH_BASE_MONTHS + 1

/** Costos por categoría de cada mes, desde el mes del primer movimiento */
async function getCategoryCosts(
  workspaceId: string,
  from: string,
  to: string,
  firstTransactionOn: string | null
): Promise<CategoryCost[]> {
  if (firstTransactionOn === null) return []

  const firstMonth = firstTransactionOn.slice(0, 7)
  const months = monthsBetween(from > firstMonth ? from : firstMonth, to)

  // category_totals es por rango: una llamada por mes, en paralelo
  const totals = await Promise.all(
    months.map((month) => {
      const range = monthRange(month)
      return getCategoryTotals(workspaceId, range.from, range.to, "expense")
    })
  )

  return months.flatMap((month, index) =>
    totals[index].map((row) => ({
      month,
      categoryId: row.categoryId,
      name: row.name,
      total: row.total
    }))
  )
}

/**
 * Insumos para calcular el score de Empresa de los meses `from` a `to`
 * (YYYY-MM). Los totales empiezan 6 meses antes de `from` para cubrir los
 * meses cerrados del crecimiento de ventas.
 */
export async function getBusinessScoreInputs(
  workspaceId: string,
  from: string,
  to: string,
  today = todayISO()
): Promise<BusinessScoreInputs> {
  const supabase = await createClient()
  const range = {
    p_workspace_id: workspaceId,
    p_from: `${businessInputsStart(from)}-01`,
    p_to: `${to}-01`
  }

  const [monthly, balances, weekly, firstTransactionOn] = await Promise.all([
    getMonthlyTotals(workspaceId, range.p_from, monthRange(to).to),
    supabase.rpc("account_monthly_balances", range),
    supabase.rpc("score_weekly_activity", range),
    getFirstTransactionOn(workspaceId)
  ])

  if (balances.error || weekly.error) {
    throw new Error("No se pudieron calcular los insumos del score")
  }

  const categoryCosts = await getCategoryCosts(
    workspaceId,
    shiftMonth(from, -CATEGORY_LOOKBACK_MONTHS),
    to,
    firstTransactionOn
  )

  const accountsBalance = new Map(
    balances.data.map((row) => [row.month.slice(0, 7), Number(row.balance)])
  )
  const months: BusinessMonthlyInput[] = monthly.map((row) => {
    const month = row.month.slice(0, 7)
    return {
      month,
      sales: row.income,
      costs: row.expense,
      accountsBalance: accountsBalance.get(month) ?? 0
    }
  })

  return {
    today,
    firstTransactionOn,
    months,
    categoryCosts,
    activeWeeks: new Set(weekly.data.map((row) => row.week_start))
  }
}

/** Insumos y score de Empresa de los 12 meses hasta el actual */
export async function getBusinessScoreHistory(
  workspaceId: string,
  today = todayISO()
) {
  const months = historyMonths(today)
  const inputs = await getBusinessScoreInputs(
    workspaceId,
    months[0],
    months[months.length - 1],
    today
  )

  return { inputs, history: businessScoreHistory(inputs) }
}

export interface CounterpartyTotal {
  /** Primer valor original del grupo */
  counterparty: string
  total: number
  txCount: number
}

/**
 * Totales por contraparte de un tipo entre `from` y `to` (YYYY-MM-DD),
 * agrupados sin distinguir mayúsculas ni espacios, del mayor al menor
 */
export async function getCounterpartyTotals(
  workspaceId: string,
  from: string,
  to: string,
  type: TransactionType
): Promise<CounterpartyTotal[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("counterparty_totals", {
    p_workspace_id: workspaceId,
    p_from: from,
    p_to: to,
    p_type: type
  })

  if (error) {
    throw new Error("No se pudieron calcular los totales por contraparte")
  }

  return data.map((row) => ({
    counterparty: row.counterparty,
    total: Number(row.total),
    txCount: Number(row.tx_count)
  }))
}
