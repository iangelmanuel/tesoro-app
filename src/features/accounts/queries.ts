import { createClient } from "@/libs/supabase/server"
import type { AccountWithBalance } from "./types"

// Todas las cuentas del espacio, activas o archivadas, con su saldo a hoy y
// con lo programado
export async function getAccountBalances(
  workspaceId: string
): Promise<AccountWithBalance[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("account_balances", {
    p_workspace_id: workspaceId
  })

  if (error) {
    throw new Error("No se pudieron cargar las cuentas")
  }

  return data.map((row) => ({
    ...row,
    opening_balance: Number(row.opening_balance),
    balance: Number(row.balance),
    scheduled_balance: Number(row.scheduled_balance)
  }))
}
