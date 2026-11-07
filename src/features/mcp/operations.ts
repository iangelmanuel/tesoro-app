import type { PostgrestError } from "@supabase/supabase-js"
import { SITE } from "@/config/site"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Json } from "@/types/database"
import type { McpContext } from "./types"

// Log de operaciones del MCP (SPEC 34). Toda escritura real deja una fila en
// mcp_operations y una por fila tocada en mcp_operation_rows, con el
// snapshot antes y después. Revertir lo hace la RPC undo_mcp_operation, en
// una transacción: la usan undo_operation, Cuenta → Agentes IA y la
// compensación de una escritura que falla a mitad de camino.

export const SNAPSHOT_TABLES = [
  "transactions",
  "transfers",
  "categories",
  "debt_entries",
  "goal_contributions",
  "receivable_installment_history"
] as const

export type SnapshotTable = (typeof SNAPSHOT_TABLES)[number]

/** Una fila tocada. before null = se creó; after null = se borró */
export interface RowChange {
  table: SnapshotTable
  rowId: string
  before: object | null
  after: object | null
}

export interface OperationInput {
  workspaceId: string
  /** Nombre de la tool: 'create_transactions' */
  tool: string
  /** '3 movimientos creados en Personal' */
  summary: string
  changes: RowChange[]
}

const UNDO_DEFAULT_ERROR = "No se pudo revertir la operación. Intenta de nuevo."

// Los mensajes de la RPC ya están en español y se muestran tal cual
const UNDO_KNOWN_MESSAGES = [
  "No se encontró la operación",
  "Esta operación ya se revirtió",
  "Pasaron más de 30 días",
  "No se puede revertir:"
]

function undoErrorMessage(error: PostgrestError) {
  if (UNDO_KNOWN_MESSAGES.some((known) => error.message.startsWith(known))) {
    return error.message
  }
  // Un trigger rechazó el snapshot restaurado (p. ej. una cuenta archivada)
  if (error.code === "23514" || error.code === "P0001") {
    return `No se pudo revertir: ${error.message}`
  }
  return UNDO_DEFAULT_ERROR
}

/** Inserta la operación y sus filas. Devuelve el id, o null si falló */
async function insertOperation(
  ctx: McpContext,
  input: OperationInput,
  status: "applied" | "failed"
): Promise<string | null> {
  const { data: operation, error } = await ctx.supabase
    .from("mcp_operations")
    .insert({
      user_id: ctx.userId,
      workspace_id: input.workspaceId,
      client_id: ctx.clientId,
      tool: input.tool,
      summary: input.summary,
      row_count: input.changes.length,
      status
    })
    .select("id")
    .single()

  if (error || !operation) {
    return null
  }

  const { error: rowsError } = await ctx.supabase
    .from("mcp_operation_rows")
    .insert(
      input.changes.map((change, position) => ({
        operation_id: operation.id,
        position,
        table_name: change.table,
        row_id: change.rowId,
        before: change.before as Json,
        after: change.after as Json
      }))
    )

  if (rowsError) {
    // Sin sus filas la operación no sirve para revertir
    await ctx.supabase.from("mcp_operations").delete().eq("id", operation.id)
    return null
  }
  return operation.id
}

/**
 * Registra una escritura que salió bien. Si el log no se puede guardar, los
 * cambios quedan hechos pero sin forma de revertirlos desde el MCP: se
 * devuelve null para que la respuesta lo avise.
 */
export async function commitOperation(
  ctx: McpContext,
  input: OperationInput
): Promise<string | null> {
  if (input.changes.length === 0) {
    return null
  }
  return insertOperation(ctx, input, "applied")
}

/**
 * Deshace lo que alcanzó a escribir una operación que falló a mitad de
 * camino. Guarda la operación como 'failed' con sus snapshots y la revierte
 * con la RPC. Si la compensación también falla, la operación queda 'failed'
 * y se puede revertir después desde Cuenta → Agentes IA.
 */
export async function compensateOperation(
  ctx: McpContext,
  input: OperationInput
): Promise<{ operationId: string | null; compensated: boolean }> {
  if (input.changes.length === 0) {
    return { operationId: null, compensated: true }
  }

  const operationId = await insertOperation(ctx, input, "failed")
  if (!operationId) {
    return { operationId: null, compensated: false }
  }

  const { error } = await ctx.supabase.rpc("undo_mcp_operation", {
    p_operation_id: operationId
  })
  if (error) {
    return { operationId, compensated: false }
  }

  // La RPC la marca 'undone'; una compensación se ve como 'failed'
  await ctx.supabase
    .from("mcp_operations")
    .update({ status: "failed", undone_at: null })
    .eq("id", operationId)

  return { operationId, compensated: true }
}

/** Revierte una operación del usuario. Lo usan el MCP y la UI */
export async function undoOperation(
  supabase: AppSupabase,
  operationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc("undo_mcp_operation", {
    p_operation_id: operationId
  })
  return error ? { ok: false, error: undoErrorMessage(error) } : { ok: true }
}

/** ¿Se puede revertir? Aplicada o fallida y dentro de la ventana */
export function canUndo(
  operation: { status: string; created_at: string },
  now = Date.now()
) {
  const windowMs = SITE.mcp.undoWindowDays * 24 * 60 * 60 * 1000
  return (
    operation.status !== "undone" &&
    now - new Date(operation.created_at).getTime() < windowMs
  )
}
