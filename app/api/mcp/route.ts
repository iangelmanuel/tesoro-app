import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { authenticateMcpRequest, jsonError } from "@/features/mcp/auth"
import { loadMcpContext } from "@/features/mcp/context"
import { hitRateLimit } from "@/features/mcp/rate-limit"
import { createMcpServer } from "@/features/mcp/server"
import { runWithSupabaseClient } from "@/libs/supabase/server"

// Endpoint MCP (SPEC 34): Streamable HTTP sin estado. POST atiende JSON-RPC
// con el Bearer del agente; GET (SSE) y DELETE (sesiones) no se usan. Todo
// pasa por RLS como el usuario del token, nunca con service_role.

function withNoStore(response: Response) {
  const headers = new Headers(response.headers)
  headers.set("Cache-Control", "no-store")
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

export async function POST(request: Request) {
  const auth = await authenticateMcpRequest(request)
  if (!auth.ok) {
    return auth.response
  }

  const retryAfter = await hitRateLimit(auth.identity.supabase)
  if (retryAfter !== null) {
    return jsonError(429, "Demasiadas llamadas. Espera un momento.", {
      "Retry-After": String(retryAfter)
    })
  }

  const ctx = await loadMcpContext(auth.identity)
  const server = createMcpServer(ctx)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  })

  try {
    await server.connect(transport)
    // Las consultas de la UI que usen las tools llaman createClient(): dentro
    // de este contexto reciben el cliente del agente
    const response = await runWithSupabaseClient(ctx.supabase, () =>
      transport.handleRequest(request)
    )
    return withNoStore(response)
  } finally {
    await server.close()
  }
}

function methodNotAllowed() {
  return jsonError(405, "Usa POST.", { Allow: "POST" })
}

export const GET = methodNotAllowed
export const DELETE = methodNotAllowed
