import { getMonthlyTotals } from "@/features/reports/queries"
import { createClient } from "@/libs/supabase/server"

// `numeric` puede llegar como string: se convierte con Number() aquí.

export interface CashFlowMonth {
  /** Primer día del mes (YYYY-MM-DD) */
  month: string
  /** Ventas del mes, con o sin cuenta */
  inflow: number
  /** Costos y gastos del mes, con o sin cuenta */
  outflow: number
  /** Entradas − salidas */
  net: number
  /** Saldo de las cuentas activas al fin del mes */
  closingBalance: number
  txCount: number
}

export interface CashFlow {
  months: CashFlowMonth[]
  /** Movimientos del periodo sin cuenta: suman en entradas y salidas, pero no mueven el saldo */
  withoutAccount: number
}

/** Saldo en cuentas al fin de cada mes entre `from` y `to` */
async function getAccountMonthlyBalances(
  workspaceId: string,
  from: string,
  to: string
) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("account_monthly_balances", {
    p_workspace_id: workspaceId,
    p_from: from,
    p_to: to
  })

  if (error) {
    throw new Error("No se pudo calcular el saldo en cuentas por mes")
  }

  return new Map(data.map((row) => [row.month, Number(row.balance)]))
}

async function countWithoutAccount(
  workspaceId: string,
  from: string,
  to: string
) {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .is("account_id", null)
    .gte("occurred_on", from)
    .lte("occurred_on", to)

  if (error) {
    throw new Error("No se pudieron contar los movimientos sin cuenta")
  }

  return count ?? 0
}

/**
 * Flujo de caja mes a mes entre `from` y `to` (inclusivos). Traspasos y
 * ajustes no son entradas ni salidas, pero sí mueven el saldo al cierre.
 */
export async function getCashFlow(
  workspaceId: string,
  from: string,
  to: string
): Promise<CashFlow> {
  const [monthly, balances, withoutAccount] = await Promise.all([
    getMonthlyTotals(workspaceId, from, to),
    getAccountMonthlyBalances(workspaceId, from, to),
    countWithoutAccount(workspaceId, from, to)
  ])

  return {
    months: monthly.map((row) => ({
      month: row.month,
      inflow: row.income,
      outflow: row.expense,
      net: row.balance,
      closingBalance: balances.get(row.month) ?? 0,
      txCount: row.txCount
    })),
    withoutAccount
  }
}
