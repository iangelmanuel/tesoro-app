import { SITE } from "@/config/site"
import type { McpIdentity } from "./auth"
import type { McpContext } from "./types"

/**
 * Completa la identidad del agente con su acceso (mcp_connections) y la
 * moneda del perfil. Sin fila, la conexión es de solo lectura.
 */
export async function loadMcpContext(
  identity: McpIdentity
): Promise<McpContext> {
  const { supabase, userId, clientId } = identity
  const [{ data: connection }, { data: profile }] = await Promise.all([
    supabase
      .from("mcp_connections")
      .select("access")
      .eq("user_id", userId)
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase.from("profiles").select("currency").eq("id", userId).maybeSingle()
  ])

  return {
    ...identity,
    access: connection?.access ?? "read",
    currency: profile?.currency ?? SITE.site.currency
  }
}
