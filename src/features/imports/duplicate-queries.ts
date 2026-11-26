import "server-only"
import type { AppSupabase } from "@/libs/supabase/types"
import type { DuplicateCandidatesResult, DuplicateRequest } from "./duplicates"
import { DUPLICATES_ERROR, INVALID_RANGE } from "./import-errors"
import { duplicateRangeSchema, linkDuplicatesSchema } from "./schemas"

/**
 * Filas existentes del destino para marcar duplicados (SPEC 08 y 08b).
 * Respetan RLS: solo llegan las del espacio del usuario.
 */
export async function getDuplicateCandidatesFor(
  supabase: AppSupabase,
  workspaceId: string,
  request: DuplicateRequest
): Promise<DuplicateCandidatesResult> {
  if (request.target === "recurring_expenses") {
    // Todos los gastos fijos del espacio, activos o no
    const { data, error } = await supabase
      .from("recurring_expenses")
      .select("name")
      .eq("workspace_id", workspaceId)

    if (error) return { error: DUPLICATES_ERROR }
    return { target: request.target, candidates: data }
  }

  if (request.target === "transactions") {
    const range = duplicateRangeSchema.safeParse(request)
    if (!range.success) return { error: INVALID_RANGE }

    const { data, error } = await supabase.rpc("transactions_for_duplicates", {
      p_workspace_id: workspaceId,
      p_from: range.data.from,
      p_to: range.data.to
    })

    if (error) return { error: DUPLICATES_ERROR }
    return {
      target: request.target,
      candidates: data.map((row) => ({ ...row, amount: Number(row.amount) }))
    }
  }

  const parsed = linkDuplicatesSchema.safeParse({
    ...request,
    ids: [...new Set(request.ids)]
  })
  if (!parsed.success || parsed.data.from > parsed.data.to) {
    return { error: INVALID_RANGE }
  }
  const { from, to, ids } = parsed.data

  if (request.target === "debt_entries") {
    const { data, error } = await supabase
      .from("debt_entries")
      .select("debt_id, kind, amount, occurred_on")
      .eq("workspace_id", workspaceId)
      .in("debt_id", ids)
      .gte("occurred_on", from)
      .lte("occurred_on", to)

    if (error) return { error: DUPLICATES_ERROR }
    return {
      target: request.target,
      // El avance (SPEC 16) y la cuota (SPEC 17) no se importan: no hay
      // duplicado posible
      candidates: data.flatMap((row) =>
        row.kind === "advance" || row.kind === "fee"
          ? []
          : [
              {
                debtId: row.debt_id,
                kind: row.kind,
                amount: Number(row.amount),
                occurred_on: row.occurred_on
              }
            ]
      )
    }
  }

  const { data, error } = await supabase
    .from("goal_contributions")
    .select("goal_id, amount, occurred_on")
    .eq("workspace_id", workspaceId)
    .in("goal_id", ids)
    .gte("occurred_on", from)
    .lte("occurred_on", to)

  if (error) return { error: DUPLICATES_ERROR }
  return {
    target: request.target,
    candidates: data.map((row) => ({
      goalId: row.goal_id,
      amount: Number(row.amount),
      occurred_on: row.occurred_on
    }))
  }
}
