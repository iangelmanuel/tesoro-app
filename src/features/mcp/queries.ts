import { createClient } from "@/libs/supabase/server"
import type { McpAccess } from "./constants"
import { canUndo } from "./operations"

// Datos de Cuenta → Agentes IA (SPEC 34). Corren con la sesión de cookies.

export interface AgentConnection {
  clientId: string
  name: string
  /** ISO del consentimiento */
  authorizedAt: string | null
  lastUsedAt: string | null
  access: McpAccess
}

export interface AgentOperation {
  id: string
  createdAt: string
  agent: string
  workspace: string | null
  summary: string
  status: "applied" | "undone" | "failed"
  canUndo: boolean
}

const HISTORY_LIMIT = 50

/**
 * Agentes autorizados: los grants del servidor OAuth de Supabase con el
 * acceso y el último uso de mcp_connections. Un grant sin fila es de solo
 * lectura, igual que en el endpoint. Si Supabase no responde los grants, se
 * usan las filas de mcp_connections.
 */
export async function getAgentConnections(): Promise<AgentConnection[]> {
  const supabase = await createClient()
  const [grants, { data: rows, error }] = await Promise.all([
    supabase.auth.oauth.listGrants(),
    supabase
      .from("mcp_connections")
      .select("client_id, client_name, access, created_at, last_used_at")
  ])

  if (error) {
    throw new Error("No se pudieron cargar los agentes conectados")
  }

  const byClient = new Map(rows.map((row) => [row.client_id, row]))

  if (grants.error || !grants.data) {
    return rows.map((row) => ({
      clientId: row.client_id,
      name: row.client_name,
      authorizedAt: row.created_at,
      lastUsedAt: row.last_used_at,
      access: row.access
    }))
  }

  return grants.data
    .map((grant) => {
      const row = byClient.get(grant.client.id)
      return {
        clientId: grant.client.id,
        name: grant.client.name.trim() || row?.client_name || "Agente de IA",
        authorizedAt: grant.granted_at,
        lastUsedAt: row?.last_used_at ?? null,
        access: row?.access ?? "read"
      }
    })
    .sort((a, b) => (b.authorizedAt ?? "").localeCompare(a.authorizedAt ?? ""))
}

/** Las últimas 50 operaciones del MCP de todos los agentes */
export async function getAgentOperations(): Promise<AgentOperation[]> {
  const supabase = await createClient()
  const [{ data, error }, { data: connections }] = await Promise.all([
    supabase
      .from("mcp_operations")
      .select("id, client_id, summary, status, created_at, workspaces(name)")
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase.from("mcp_connections").select("client_id, client_name")
  ])

  if (error) {
    throw new Error("No se pudo cargar el historial de los agentes")
  }

  const names = new Map(
    (connections ?? []).map((row) => [row.client_id, row.client_name])
  )
  const now = Date.now()
  return data.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    agent: names.get(row.client_id) ?? "Agente revocado",
    workspace: row.workspaces?.name ?? null,
    summary: row.summary,
    status: row.status,
    canUndo: canUndo(row, now)
  }))
}
