import {
  DISCOVERY_HEADERS,
  protectedResourceMetadata
} from "@/features/mcp/discovery"

// Metadato del recurso protegido (RFC 9728) en la raíz, para clientes que no
// le agregan la ruta del recurso. Igual al de /api/mcp
export function GET() {
  return Response.json(protectedResourceMetadata(), {
    headers: DISCOVERY_HEADERS
  })
}
