import { SITE } from "@/config/site"
import type { McpIdentity } from "./auth"
import { MCP_FALLBACK_CLIENT_NAME } from "./constants"
import type { McpContext } from "./types"

// last_used_at se actualiza como máximo una vez por minuto por conexión
const LAST_USED_THROTTLE_MS = 60_000

/**
 * Completa la identidad del agente con su acceso (mcp_connections) y la
 * moneda del perfil. Un token sin fila (p. ej. falló el upsert del
 * consentimiento) crea una con acceso de solo lectura: el agente nunca queda
 * con escritura por accidente.
 */
export async function loadMcpContext(
  identity: McpIdentity
): Promise<McpContext> {
  const { supabase, userId, clientId } = identity
  const [{ data: connection }, { data: profile }] = await Promise.all([
    supabase
      .from("mcp_connections")
      .select("access, last_used_at")
      .eq("user_id", userId)
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase.from("profiles").select("currency").eq("id", userId).maybeSingle()
  ])

  const now = new Date()
  if (!connection) {
    // ignoreDuplicates: si otra llamada la creó a la vez, se respeta esa
    await supabase.from("mcp_connections").upsert(
      {
        user_id: userId,
        client_id: clientId,
        client_name: MCP_FALLBACK_CLIENT_NAME,
        access: "read",
        last_used_at: now.toISOString()
      },
      { onConflict: "user_id,client_id", ignoreDuplicates: true }
    )
  } else if (
    connection.last_used_at === null ||
    now.getTime() - new Date(connection.last_used_at).getTime() >=
      LAST_USED_THROTTLE_MS
  ) {
    await supabase
      .from("mcp_connections")
      .update({ last_used_at: now.toISOString() })
      .eq("user_id", userId)
      .eq("client_id", clientId)
  }

  return {
    ...identity,
    access: connection?.access ?? "read",
    currency: profile?.currency ?? SITE.site.currency
  }
}
