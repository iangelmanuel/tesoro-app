import { z } from "zod"
import { toolError, toolResult } from "../result"
import {
  INVALID_CURSOR,
  afterCursorFilter,
  cursorSchema,
  dateSchema,
  decodeCursor,
  defineTool,
  encodeCursor,
  formatTime,
  limitSchema,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"

const input = z.object({
  workspace_id: workspaceIdSchema,
  from: dateSchema.optional().describe("Desde (incluido), YYYY-MM-DD."),
  to: dateSchema.optional().describe("Hasta (incluido), YYYY-MM-DD."),
  account_id: z
    .uuid()
    .optional()
    .describe("Solo los traspasos que salen de esta cuenta o llegan a ella."),
  limit: limitSchema,
  cursor: cursorSchema
})

interface RawTransfer {
  id: string
  amount: number
  occurred_on: string
  occurred_time: string | null
  day_position: number
  created_at: string
  note: string | null
  from_account: { id: string; name: string } | null
  to_account: { id: string; name: string } | null
}

export const listTransfers = defineTool({
  name: "list_transfers",
  group: "read",
  title: "Listar traspasos",
  description:
    "Traspasos entre cuentas del espacio, del más reciente al más antiguo, con cuenta de origen y de destino. No cuentan como ingreso ni gasto. Pagina con limit y next_cursor.",
  input,
  annotations: { readOnlyHint: true },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    const cursor = args.cursor ? decodeCursor(args.cursor) : null
    if (args.cursor && !cursor) {
      return toolError(INVALID_CURSOR)
    }

    let query = ctx.supabase
      .from("transfers")
      .select(
        "id, amount, occurred_on, occurred_time, day_position, created_at, note, from_account:accounts!transfers_from_account_id_workspace_id_fkey(id, name), to_account:accounts!transfers_to_account_id_workspace_id_fkey(id, name)"
      )
      .eq("workspace_id", workspace.id)

    if (args.from) query = query.gte("occurred_on", args.from)
    if (args.to) query = query.lte("occurred_on", args.to)
    if (args.account_id) {
      query = query.or(
        `from_account_id.eq.${args.account_id},to_account_id.eq.${args.account_id}`
      )
    }
    if (cursor) {
      query = query.or(afterCursorFilter(cursor))
    }

    const { data, error } = await query
      .order("occurred_on", { ascending: false })
      .order("day_position", { ascending: true })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(args.limit + 1)

    if (error) {
      return toolError("No se pudieron cargar los traspasos.")
    }

    const rows = data as unknown as RawTransfer[]
    const page = rows.slice(0, args.limit)
    const last = page.at(-1)
    const nextCursor =
      rows.length > args.limit && last ? encodeCursor(last) : null

    return toolResult(
      `${page.length} traspasos en ${workspace.name}${nextCursor ? " (hay más: usa next_cursor)" : ""}.`,
      {
        workspace_id: workspace.id,
        transfers: page.map((row) => ({
          id: row.id,
          amount: Number(row.amount),
          occurred_on: row.occurred_on,
          time: formatTime(row.occurred_time),
          note: row.note,
          from_account: row.from_account,
          to_account: row.to_account
        })),
        next_cursor: nextCursor,
        currency: ctx.currency
      }
    )
  }
})
