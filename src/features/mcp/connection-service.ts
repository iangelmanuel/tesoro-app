import "server-only"
import type { AppSupabase } from "@/libs/supabase/types"
import { MCP_FALLBACK_CLIENT_NAME, type McpAccess } from "./constants"

// Conexiones de agentes (SPEC 34): el consentimiento OAuth del servidor de
// Supabase y la fila de mcp_connections con el acceso elegido. Supabase
// guarda el grant; si la fila falta, el agente queda en solo lectura (una
// conexión sin fila cae en 'read').

/** La solicitud de autorización venció o no es válida */
export const INVALID_REQUEST =
  "Esta solicitud ya no es válida. Vuelve a conectar desde tu agente."
const CONSENT_ERROR = "No se pudo completar la autorización. Intenta de nuevo"

/** URL a la que vuelve el agente, o el error para el formulario */
export type ConsentResult = { redirectUrl: string } | { error: string }

/** Id del usuario de la sesión, o null sin sesión */
export async function sessionUserId(supabase: AppSupabase) {
  const {
    data: { user }
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

/** Guarda (o crea) la conexión del agente con su acceso. true si se guardó */
export async function saveConnectionAccess(
  supabase: AppSupabase,
  connection: {
    userId: string
    clientId: string
    clientName: string
    access: McpAccess
  }
) {
  const { error } = await supabase.from("mcp_connections").upsert(
    {
      user_id: connection.userId,
      client_id: connection.clientId,
      client_name: connection.clientName || MCP_FALLBACK_CLIENT_NAME,
      access: connection.access
    },
    { onConflict: "user_id,client_id" }
  )
  return !error
}

/**
 * Aprueba la autorización y guarda el acceso elegido. El cliente se lee del
 * servidor de auth, nunca del formulario. Ya autorizado antes, Supabase
 * devuelve directo la URL de vuelta.
 */
export async function approveConsent(
  supabase: AppSupabase,
  authorizationId: string,
  access: McpAccess
): Promise<ConsentResult> {
  const userId = await sessionUserId(supabase)
  if (!userId) {
    return { error: INVALID_REQUEST }
  }

  const { data: details, error: detailsError } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
  if (detailsError || !details) {
    return { error: INVALID_REQUEST }
  }
  if (!("authorization_id" in details)) {
    return { redirectUrl: details.redirect_url }
  }

  const { data, error } = await supabase.auth.oauth.approveAuthorization(
    authorizationId,
    { skipBrowserRedirect: true }
  )
  if (error || !data) {
    return { error: CONSENT_ERROR }
  }

  // Un fallo aquí no bloquea la autorización: la conexión queda en lectura
  await saveConnectionAccess(supabase, {
    userId,
    clientId: details.client.id,
    clientName: details.client.name.trim().slice(0, 120),
    access
  })

  return { redirectUrl: data.redirect_url }
}

/** Rechaza la autorización */
export async function denyConsent(
  supabase: AppSupabase,
  authorizationId: string
): Promise<ConsentResult> {
  const { data, error } = await supabase.auth.oauth.denyAuthorization(
    authorizationId,
    { skipBrowserRedirect: true }
  )
  if (error || !data) {
    return { error: INVALID_REQUEST }
  }
  return { redirectUrl: data.redirect_url }
}

/**
 * Revoca un agente: Supabase borra su grant y sus sesiones (la siguiente
 * llamada responde 401) y se borra su fila de mcp_connections. Su historial
 * se conserva. true si se revocó.
 */
export async function revokeConnection(
  supabase: AppSupabase,
  userId: string,
  clientId: string
) {
  const { error } = await supabase.auth.oauth.revokeGrant({ clientId })
  if (error) {
    return false
  }

  await supabase
    .from("mcp_connections")
    .delete()
    .eq("user_id", userId)
    .eq("client_id", clientId)
  return true
}
