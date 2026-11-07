import { cacheLife } from "next/cache"
import { SITE } from "@/config/site"

// Metadatos de descubrimiento OAuth del servidor MCP (SPEC 34). Los clientes
// (Claude, ChatGPT…) los leen al recibir el 401 de /api/mcp para saber dónde
// iniciar sesión: el servidor de autorización es el OAuth 2.1 de Supabase.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "")

export const DISCOVERY_HEADERS = {
  "Cache-Control": "public, max-age=3600"
} as const

/** URL pública del recurso protegido: el endpoint MCP */
export const MCP_RESOURCE_URL = `${SITE.site.url}${SITE.mcp.path}`

/** Ruta del metadato del recurso (RFC 9728) que anuncia el 401 */
export const MCP_RESOURCE_METADATA_URL = `${SITE.site.url}/.well-known/oauth-protected-resource${SITE.mcp.path}`

export const AUTHORIZATION_SERVER = `${SUPABASE_URL}/auth/v1`

/** Metadato del recurso protegido (RFC 9728) */
export function protectedResourceMetadata() {
  return {
    resource: MCP_RESOURCE_URL,
    authorization_servers: [AUTHORIZATION_SERVER],
    bearer_methods_supported: ["header"],
    resource_name: SITE.info.name,
    resource_documentation: `${SITE.site.url}${SITE.mcp.docsPath}`
  }
}

/**
 * Metadato del servidor de autorización (RFC 8414) tal como lo publica
 * Supabase. Se cachea por horas; si Supabase falla, lanza y no se cachea.
 */
export async function authorizationServerMetadata(): Promise<unknown> {
  "use cache"
  cacheLife("hours")

  const response = await fetch(
    `${SUPABASE_URL}/.well-known/oauth-authorization-server/auth/v1`,
    { signal: AbortSignal.timeout(5000) }
  )
  if (!response.ok) {
    throw new Error(`Supabase respondió ${response.status}`)
  }
  return response.json()
}
