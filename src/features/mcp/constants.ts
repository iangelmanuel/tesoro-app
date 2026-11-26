import type { Database } from "@/types/database"

/** Acceso de un agente: lectura o escritura */
export type McpAccess = Database["public"]["Enums"]["mcp_access"]

/** Accesos que se pueden elegir */
export const MCP_ACCESS_VALUES = [
  "write",
  "read"
] as const satisfies readonly McpAccess[]

/**
 * Acceso de una conexión (SPEC 34). Lo usan el consentimiento y Cuenta →
 * Agentes IA. "Leer y escribir" va primero: es el valor por defecto al
 * autorizar.
 */
export const MCP_ACCESS_OPTIONS: Record<
  McpAccess,
  { label: string; description: string }
> = {
  write: {
    label: "Leer y escribir",
    description:
      "Ve tus datos. Puede registrar, editar, borrar y deshacer movimientos, pagos y traspasos. También crea y edita cuentas, deudas, fijos, metas y presupuestos."
  },
  read: {
    label: "Solo lectura",
    description:
      "Ve tus movimientos, cuentas, reportes y score. No puede cambiar nada."
  }
}

/** Nombre que se guarda si el cliente OAuth no trae uno */
export const MCP_FALLBACK_CLIENT_NAME = "Agente de IA"

/** Cuenta → Agentes IA (también en SITE.account.sections) */
export const MCP_AGENTS_PATH = "/dashboard/account/agents"
