import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import type { ZodObject, ZodRawShape, z } from "zod"
import type { AppSupabase } from "@/libs/supabase/types"
import type { McpAccess } from "./constants"

export interface ConsentFormState {
  /** Error general: solicitud vencida o falla del servidor de auth */
  error?: string
}

/** Contexto de una llamada al MCP: el agente actúa como el usuario */
export interface McpContext {
  /** Cliente con el Bearer del agente: todo pasa por RLS */
  supabase: AppSupabase
  userId: string
  clientId: string
  access: McpAccess
  /** Moneda del perfil, para cada respuesta */
  currency: string
}

export interface McpToolDefinition<
  Input extends ZodObject<ZodRawShape> = ZodObject<ZodRawShape>
> {
  /** snake_case en inglés: 'create_transactions' */
  name: string
  group: "read" | "write" | "undo"
  /** En español: 'Crear movimientos' */
  title: string
  description: string
  input: Input
  annotations: { readOnlyHint?: boolean; destructiveHint?: boolean }
}

/** Una tool del servidor: su definición y lo que hace */
export interface McpTool<
  Input extends ZodObject<ZodRawShape> = ZodObject<ZodRawShape>
> extends McpToolDefinition<Input> {
  run: (ctx: McpContext, input: z.output<Input>) => Promise<CallToolResult>
}
