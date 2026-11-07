import {
  DISCOVERY_HEADERS,
  authorizationServerMetadata
} from "@/features/mcp/discovery"

// Reenvía el metadato del servidor OAuth de Supabase (RFC 8414) para los
// clientes que lo buscan en el origen del recurso y no en el del servidor de
// autorización
export async function GET() {
  try {
    return Response.json(await authorizationServerMetadata(), {
      headers: DISCOVERY_HEADERS
    })
  } catch {
    return Response.json(
      { error: "No se pudo leer la configuración de autorización." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    )
  }
}
