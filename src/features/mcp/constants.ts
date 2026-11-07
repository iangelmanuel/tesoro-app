import type { Database } from "@/types/database"

export type McpAccess = Database["public"]["Enums"]["mcp_access"]

export const MCP_ACCESS_VALUES = [
  "write",
  "read"
] as const satisfies readonly McpAccess[]

// Acceso de una conexión (SPEC 34). Lo usan el consentimiento y Cuenta →
// Agentes IA. "Leer y escribir" va primero: es el valor por defecto al
// autorizar.
export const MCP_ACCESS_OPTIONS: Record<
  McpAccess,
  { label: string; description: string }
> = {
  write: {
    label: "Leer y escribir",
    description:
      "Ve tus datos y puede registrar, editar, borrar y revertir movimientos y traspasos."
  },
  read: {
    label: "Solo lectura",
    description:
      "Ve tus movimientos, cuentas, reportes y score. No puede cambiar nada."
  }
}

// Nombre que se guarda si el cliente OAuth no trae uno
export const MCP_FALLBACK_CLIENT_NAME = "Agente de IA"
