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

// Saldo de una cuenta a una fecha (YYYY-MM-DD), con las mismas reglas que
// account_balances. Devuelve null si la cuenta no existe o no es del usuario:
// la función es security invoker y la RLS de accounts solo deja ver al dueño
// del espacio, así que no hay forma de leer el saldo de una cuenta ajena.
export async function getAccountBalanceAt(
  accountId: string,
  on: string
): Promise<number | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("account_balance_at", {
    p_account_id: accountId,
    p_on: on
  })

  if (error) {
    throw new Error("No se pudo calcular el saldo de la cuenta")
  }

  return data === null ? null : Number(data)
}
