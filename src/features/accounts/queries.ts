import { cache } from "react"
import { createClient } from "@/libs/supabase/server"
import type { AccountWithBalance } from "./types"

// Todas las cuentas del espacio, activas o archivadas, con su saldo a hoy y
// con lo programado
// cache(): los accesos rápidos del header y las tarjetas del Resumen la
// piden en el mismo request; así se consulta una sola vez
export const getAccountBalances = cache(
  async (workspaceId: string): Promise<AccountWithBalance[]> => {
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
)
