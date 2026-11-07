import { z } from "zod"
import type { WorkspaceType } from "@/features/workspaces/queries"
import type { McpContext, McpTool } from "../types"

// Piezas comunes de las tools (SPEC 34): esquemas de entrada, el espacio y
// el paginado por cursor.

export const WORKSPACE_NOT_FOUND = "Espacio no encontrado."
// Presupuestos, metas, deudas, fijos y Me deben solo existen en Personal
export const PERSONAL_ONLY = "Solo disponible en el espacio Personal."
export const WORKSPACE_NOT_WRITABLE =
  "Este espacio está marcado para borrarse y no admite cambios."

export const workspaceIdSchema = z
  .string()
  .describe("Id del espacio (de list_workspaces).")

export const dateSchema = z.iso.date({ error: "Usa una fecha YYYY-MM-DD." })

export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Usa un mes YYYY-MM.")

export const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(200)
  .default(50)
  .describe("Filas por página (1–200, por defecto 50).")

export const cursorSchema = z
  .string()
  .max(500)
  .optional()
  .describe("Cursor de la respuesta anterior (next_cursor) para seguir.")

/** Borra el tipo genérico de la entrada para guardar la tool en una lista */
export function defineTool<Input extends McpTool["input"]>(
  tool: McpTool<Input>
): McpTool {
  return tool as unknown as McpTool
}

export interface McpWorkspace {
  id: string
  type: WorkspaceType
  name: string
  deletionRequestedAt: string | null
}

/**
 * Espacio del usuario por id con el cliente del agente (RLS solo deja ver
 * los propios). Con `writable`, un espacio marcado para borrar se rechaza,
 * como requireWritableWorkspace.
 */
export async function resolveWorkspace(
  ctx: McpContext,
  id: string,
  { writable = false } = {}
): Promise<McpWorkspace | { error: string }> {
  if (!z.uuid().safeParse(id).success) {
    return { error: WORKSPACE_NOT_FOUND }
  }

  const { data } = await ctx.supabase
    .from("workspaces")
    .select("id, type, name, deletion_requested_at")
    .eq("id", id)
    .maybeSingle()

  if (!data) {
    return { error: WORKSPACE_NOT_FOUND }
  }
  if (writable && data.deletion_requested_at !== null) {
    return { error: WORKSPACE_NOT_WRITABLE }
  }
  return {
    id: data.id,
    type: data.type,
    name: data.name,
    deletionRequestedAt: data.deletion_requested_at
  }
}

/** "14:30:00" → "14:30"; sin hora, null */
export function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : null
}

// Cursor del orden de la lista de movimientos (SPEC 19): occurred_on desc,
// day_position asc, created_at desc, id asc. Es opaco para el agente.
const cursorPayload = z.object({
  d: z.iso.date(),
  p: z.number().int(),
  c: z.string().min(1).max(64),
  i: z.uuid()
})

export type LedgerCursor = z.infer<typeof cursorPayload>

export function encodeCursor(row: {
  occurred_on: string
  day_position: number
  created_at: string
  id: string
}) {
  const payload: LedgerCursor = {
    d: row.occurred_on,
    p: row.day_position,
    c: row.created_at,
    i: row.id
  }
  return Buffer.from(JSON.stringify(payload)).toString("base64url")
}

export function decodeCursor(cursor: string): LedgerCursor | null {
  try {
    const json: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    )
    const parsed = cursorPayload.safeParse(json)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * Filtro `or` de PostgREST para las filas que van después del cursor en el
 * orden de la lista. Los valores van entre comillas: fechas y timestamps
 * llevan `:` y `+`.
 */
export function afterCursorFilter({ d, p, c, i }: LedgerCursor) {
  const date = `"${d}"`
  const created = `"${c}"`
  return [
    `occurred_on.lt.${date}`,
    `and(occurred_on.eq.${date},day_position.gt.${p})`,
    `and(occurred_on.eq.${date},day_position.eq.${p},created_at.lt.${created})`,
    `and(occurred_on.eq.${date},day_position.eq.${p},created_at.eq.${created},id.gt.${i})`
  ].join(",")
}

export const INVALID_CURSOR =
  "El cursor no es válido. Repite la consulta sin cursor."
