import "server-only"
import {
  type ServiceResult,
  type ServiceWorkspace,
  fail
} from "@/features/workspaces/service-result"
import type { AppSupabase } from "@/libs/supabase/types"

// Orden manual de la lista unificada de Movimientos (SPEC 19)

/** Tipos de fila de ledger_entries que se pueden reordenar */
export const LEDGER_KINDS = [
  "income",
  "expense",
  "transfer",
  "adjustment",
  "debt_payment",
  "debt_advance",
  "goal_contribution"
] as const

/** Tipo de fila de ledger_entries */
export type LedgerEntryKind = (typeof LEDGER_KINDS)[number]

const MOVE_DEFAULT_ERROR = "No se pudo reordenar el movimiento"
const MOVE_FORBIDDEN = "No tienes permiso para reordenar en este espacio"
const MOVE_OTHER_DAY = "Solo se puede reordenar dentro del mismo día"

/**
 * Mueve una fila a la posición de otra del mismo día. Cubre movimientos,
 * traspasos, ajustes, pagos de tarjeta, avances y aportes: el orden es el de
 * la lista unificada.
 */
export async function moveLedgerEntryRecord(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  entry: { kind: LedgerEntryKind; id: string },
  target: { kind: LedgerEntryKind; id: string }
): Promise<ServiceResult<object>> {
  const { error } = await supabase.rpc("move_ledger_entry", {
    p_workspace_id: workspace.id,
    p_kind: entry.kind,
    p_id: entry.id,
    p_target_kind: target.kind,
    p_target_id: target.id
  })

  if (error) {
    if (error.code === "42501") {
      return fail({ error: MOVE_FORBIDDEN })
    }
    if (error.message.includes("mismo día")) {
      return fail({ error: MOVE_OTHER_DAY })
    }
    return fail({ error: MOVE_DEFAULT_ERROR })
  }
  return { ok: true }
}
