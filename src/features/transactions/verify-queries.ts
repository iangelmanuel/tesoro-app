import "server-only"
import { createClient } from "@/libs/supabase/server"
import { VERIFY_PAGE_SIZE } from "./constants"
import type { VerifyEntry } from "./types"

/**
 * Historial completo sin filtro de mes, de lo más reciente hacia atrás, con el
 * mismo orden que la tabla de Movimientos. Pide una fila de más para saber si
 * quedan páginas sin usar count exact.
 */
export async function getVerifyEntries(
  workspaceId: string,
  options: { accountId?: string; offset: number }
): Promise<{ rows: VerifyEntry[]; hasMore: boolean }> {
  const supabase = await createClient()
  let query = supabase
    .from("ledger_entries")
    .select(
      "id, kind, amount, occurred_on, occurred_time, account_id, to_account_id, description, note"
    )
    .eq("workspace_id", workspaceId)

  if (options.accountId) {
    // Cuenta del movimiento o del ajuste, u origen o destino del traspaso
    query = query.or(
      `account_id.eq.${options.accountId},to_account_id.eq.${options.accountId}`
    )
  }

  const { data, error } = await query
    .order("occurred_on", { ascending: false })
    .order("day_position", { ascending: true })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(options.offset, options.offset + VERIFY_PAGE_SIZE)

  if (error) {
    throw new Error("No se pudieron cargar los movimientos")
  }

  return {
    rows: data.slice(0, VERIFY_PAGE_SIZE).map((row) => ({
      key: `${row.kind}:${row.id}`,
      kind: row.kind as string,
      amount: Number(row.amount),
      occurred_on: row.occurred_on as string,
      occurred_time: row.occurred_time,
      account_id: row.account_id,
      to_account_id: row.to_account_id,
      title: row.description ?? "",
      note: row.note
    })),
    hasMore: data.length > VERIFY_PAGE_SIZE
  }
}
