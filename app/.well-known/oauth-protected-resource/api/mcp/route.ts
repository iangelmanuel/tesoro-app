import {
  DISCOVERY_HEADERS,
  protectedResourceMetadata
} from "@/features/mcp/discovery"

// Metadato del recurso protegido /api/mcp (RFC 9728). Es el que anuncia el
// WWW-Authenticate del 401 del endpoint MCP
export function GET() {
  return Response.json(protectedResourceMetadata(), {
    headers: DISCOVERY_HEADERS
  })
}
