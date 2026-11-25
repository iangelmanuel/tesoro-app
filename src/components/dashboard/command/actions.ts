"use server"

import type { Route } from "next"
import { ACCOUNTS_PATH } from "@/features/accounts/constants"
import { DEBTS_PATH, RECEIVABLES_PATH } from "@/features/debts/tabs"
import { GOALS_PATH } from "@/features/goals/progress"
import { workspaceBasePath } from "@/features/workspaces/paths"
import { requireWorkspace } from "@/features/workspaces/queries"
import { createClient } from "@/libs/supabase/server"
import { DETAIL_PARAM } from "./detail-param"

export interface CommandEntity {
  id: string
  kind: "account" | "debt" | "goal"
  name: string
  /** Página que abre el detalle: lleva `?detalle=<id>` cuando hay panel */
  href: Route
}

/**
 * Cuentas, deudas y metas del espacio para el grupo "Tus datos" de la
 * paleta (SPEC 51 §5). Solo id y nombre. El espacio se valida contra el
 * usuario (requireWorkspace) y cada consulta filtra por él y pasa por RLS:
 * nunca devuelve datos de otro espacio ni de otro usuario. Empresa no tiene
 * deudas ni metas
 */
export async function loadCommandEntities(
  workspaceId: string
): Promise<CommandEntity[]> {
  const workspace = await requireWorkspace(workspaceId)
  const supabase = await createClient()
  const isPersonal = workspace.type === "personal"
  const accountsPath = isPersonal
    ? ACCOUNTS_PATH
    : `${workspaceBasePath({ id: workspace.id, type: "business" })}/accounts`

  const [accounts, debts, goals] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .is("archived_at", null)
      .order("name"),
    isPersonal
      ? supabase
          .from("debts")
          .select("id, name, kind")
          .eq("workspace_id", workspace.id)
          .eq("status", "active")
          .order("name")
      : null,
    isPersonal
      ? supabase
          .from("savings_goals")
          .select("id, name")
          .eq("workspace_id", workspace.id)
          .eq("status", "active")
          .order("name")
      : null
  ])

  if (accounts.error || debts?.error || goals?.error) {
    throw new Error("No se pudieron cargar tus datos")
  }

  // Las cuentas no tienen panel de detalle: llevan a su página
  return [
    ...accounts.data.map((row) => ({
      id: row.id,
      kind: "account" as const,
      name: row.name,
      href: accountsPath as Route
    })),
    ...(debts?.data ?? []).map((row) => ({
      id: row.id,
      kind: "debt" as const,
      name: row.name,
      // Las cuentas por cobrar viven en su pestaña (Me deben)
      href: (row.kind === "receivable"
        ? `${RECEIVABLES_PATH}&${DETAIL_PARAM}=${row.id}`
        : `${DEBTS_PATH}?${DETAIL_PARAM}=${row.id}`) as Route
    })),
    ...(goals?.data ?? []).map((row) => ({
      id: row.id,
      kind: "goal" as const,
      name: row.name,
      href: `${GOALS_PATH}?${DETAIL_PARAM}=${row.id}` as Route
    }))
  ]
}
