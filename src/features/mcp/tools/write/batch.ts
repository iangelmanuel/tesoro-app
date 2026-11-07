import { z } from "zod"
import { SITE } from "@/config/site"
import type { ServiceFailure } from "@/libs/service-result"
import type { McpContext } from "../../types"
import { toolError, toolResult } from "../result"

// Piezas de las escrituras en lote (SPEC 34): todo o nada. Primero se
// validan todas las filas; si una falla no se escribe ninguna y la respuesta
// lista cada error con su índice (desde 0).

export interface RowError {
  index: number
  field?: string
  message: string
}

/** Lista de 1 a SITE.mcp.bulkLimit elementos */
export function bulk<T extends z.ZodType>(item: T, what: string) {
  return z
    .array(item)
    .min(1, { error: `Envía al menos un ${what}.` })
    .max(SITE.mcp.bulkLimit, {
      error: `Máximo ${SITE.mcp.bulkLimit} por llamada.`
    })
}

export const dryRunSchema = z
  .boolean()
  .default(false)
  .describe(
    "true: valida y muestra el antes y el después de cada fila sin guardar nada."
  )

/** Hora HH:MM, o null para quitarla */
export const timeInputSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usa una hora HH:MM.")
  .nullable()

// Los esquemas de la UI nombran la hora occurred_time; el MCP, time
const FIELD_ALIASES: Record<string, string> = { occurred_time: "time" }

export function zodRowErrors(index: number, error: z.ZodError): RowError[] {
  return error.issues.map((issue) => {
    const field = issue.path.map(String).join(".")
    return {
      index,
      ...(field ? { field: FIELD_ALIASES[field] ?? field } : {}),
      message: issue.message
    }
  })
}

export function failureRowErrors(
  index: number,
  failure: Pick<ServiceFailure, "error" | "fieldErrors">
): RowError[] {
  const errors: RowError[] = Object.entries(failure.fieldErrors ?? {}).flatMap(
    ([field, messages]) =>
      (messages ?? []).map((message) => ({
        index,
        field: FIELD_ALIASES[field] ?? field,
        message
      }))
  )
  if (failure.error || errors.length === 0) {
    errors.unshift({
      index,
      message: failure.error ?? "No se pudo guardar esta fila."
    })
  }
  return errors
}

/** Ids repetidos en la misma llamada */
export function duplicateIdErrors(ids: string[]): RowError[] {
  const seen = new Set<string>()
  return ids.flatMap((id, index) => {
    if (seen.has(id)) {
      return [{ index, field: "id", message: "Este id está repetido." }]
    }
    seen.add(id)
    return []
  })
}

export function batchError(errors: RowError[]) {
  const rows = new Set(errors.map((error) => error.index)).size
  return toolError(
    `No se guardó nada: ${rows} ${rows === 1 ? "fila tiene" : "filas tienen"} errores.`,
    { errors }
  )
}

/** Falla a mitad de camino: se deshizo lo escrito (o quedó para revertir) */
export function midwayError(
  index: number,
  failure: Pick<ServiceFailure, "error" | "fieldErrors">,
  compensation: { operationId: string | null; compensated: boolean }
) {
  const errors = failureRowErrors(index, failure)
  return toolError(
    compensation.compensated
      ? `No se guardó nada: la fila ${index} falló al escribir y se deshicieron las anteriores.`
      : `La fila ${index} falló al escribir y no se pudieron deshacer las anteriores. Revierte la operación ${compensation.operationId ?? ""} desde Tesoro → Cuenta → Agentes IA.`.trim(),
    {
      errors,
      operation_id: compensation.operationId,
      compensated: compensation.compensated
    }
  )
}

export function writeResult(
  ctx: McpContext,
  {
    operationId,
    summary,
    ids
  }: { operationId: string | null; summary: string; ids: string[] }
) {
  return toolResult(
    operationId
      ? `${summary}. Para deshacerlo: undo_operation con ${operationId}.`
      : `${summary}. No se pudo registrar para revertir.`,
    {
      operation_id: operationId,
      row_count: ids.length,
      summary,
      ids,
      currency: ctx.currency
    }
  )
}

/**
 * Cuentas del espacio por id, para validar antes de escribir: una cuenta
 * debe existir en el espacio y estar activa.
 */
export async function accountErrors(
  ctx: McpContext,
  workspaceId: string,
  rows: { index: number; accountId: string | null; field: string }[]
): Promise<RowError[]> {
  const ids = [
    ...new Set(rows.flatMap((row) => (row.accountId ? [row.accountId] : [])))
  ]
  if (ids.length === 0) {
    return []
  }

  const { data } = await ctx.supabase
    .from("accounts")
    .select("id, archived_at")
    .eq("workspace_id", workspaceId)
    .in("id", ids)

  const accounts = new Map((data ?? []).map((row) => [row.id, row]))
  return rows.flatMap((row) => {
    if (!row.accountId) {
      return []
    }
    const account = accounts.get(row.accountId)
    if (!account) {
      return [
        {
          index: row.index,
          field: row.field,
          message: "Elige una cuenta válida"
        }
      ]
    }
    if (account.archived_at !== null) {
      return [
        {
          index: row.index,
          field: row.field,
          message: "La cuenta está archivada"
        }
      ]
    }
    return []
  })
}
