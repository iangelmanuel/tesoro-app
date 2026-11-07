import { createClient } from "@supabase/supabase-js"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Database } from "@/types/database"
import { MCP_RESOURCE_METADATA_URL } from "./discovery"

// Bearer del agente → claims → cliente de Supabase como el usuario (SPEC 34).
// Solo clave publicable: las lecturas y escrituras pasan por RLS. Nunca
// service_role. Todo el uso del servidor OAuth (beta) de Supabase en el
// endpoint vive aquí.

export interface McpIdentity {
  supabase: AppSupabase
  userId: string
  clientId: string
}

export type McpAuthResult =
  { ok: true; identity: McpIdentity } | { ok: false; response: Response }

const NO_STORE = { "Cache-Control": "no-store" } as const

/** 401 que lleva al cliente al descubrimiento OAuth (RFC 9728) */
export function unauthorized(message = "Inicia sesión para usar Tesoro.") {
  return Response.json(
    { error: message },
    {
      status: 401,
      headers: {
        ...NO_STORE,
        "WWW-Authenticate": `Bearer resource_metadata="${MCP_RESOURCE_METADATA_URL}"`
      }
    }
  )
}

export function jsonError(status: number, error: string, headers = {}) {
  return Response.json(
    { error },
    { status, headers: { ...NO_STORE, ...headers } }
  )
}

function readBearer(request: Request) {
  const header = request.headers.get("authorization") ?? ""
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  return match?.[1] ?? null
}

function createAgentClient(token: string): AppSupabase {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    }
  )
}

/**
 * Valida el Bearer: firma por JWKS y expiración (getClaims). Exige el claim
 * client_id, que solo traen los tokens del servidor OAuth: un token de sesión
 * del navegador no sirve. Una cuenta marcada para borrar recibe 403.
 */
export async function authenticateMcpRequest(
  request: Request
): Promise<McpAuthResult> {
  const token = readBearer(request)
  if (!token) {
    return { ok: false, response: unauthorized() }
  }

  const supabase = createAgentClient(token)
  // Un JWT malformado hace que getClaims lance en vez de devolver error
  const { data, error } = await supabase.auth
    .getClaims(token)
    .catch((cause: unknown) => ({ data: null, error: cause }))
  const claims = data?.claims

  if (error || !claims?.sub) {
    return { ok: false, response: unauthorized("El token no es válido.") }
  }

  const clientId: unknown = claims.client_id
  if (typeof clientId !== "string" || clientId.length === 0) {
    return { ok: false, response: unauthorized("El token no es de un agente.") }
  }

  if (typeof claims.app_metadata?.deletion_requested_at === "string") {
    return {
      ok: false,
      response: jsonError(403, "Tu cuenta está en proceso de borrado.")
    }
  }

  return { ok: true, identity: { supabase, userId: claims.sub, clientId } }
}
