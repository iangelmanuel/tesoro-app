import { z } from "zod"
import { TRANSACTION_TYPES } from "@/features/categories/constants"
import { escapeLikePattern } from "@/features/transactions/filters"
import { quotePostgrestValue } from "@/features/transactions/queries"
import { toolError, toolResult } from "../result"
import {
  INVALID_CURSOR,
  afterCursorFilter,
  cursorSchema,
  dateSchema,
  decodeCursor,
  defineTool,
  encodeCursor,
  limitSchema,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"
import {
  LINK_KINDS,
  type RawTransaction,
  toApiTransaction,
  transactionColumns
} from "./transaction-row"

const input = z.object({
  workspace_id: workspaceIdSchema,
  from: dateSchema.optional().describe("Desde (incluido), YYYY-MM-DD."),
  to: dateSchema.optional().describe("Hasta (incluido), YYYY-MM-DD."),
  type: z
    .enum(TRANSACTION_TYPES)
    .optional()
    .describe("income (ingreso) o expense (gasto)."),
  category_id: z.uuid().optional().describe("Id de una categoría."),
  account_id: z.uuid().optional().describe("Id de una cuenta."),
  search: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe("Busca en la descripción y la nota."),
  linked: z
    .enum(LINK_KINDS)
    .default("any")
    .describe(
      "Vínculo: any (todos), none (sin vínculo), debt (pago de deuda o avance de tarjeta), recurring_expense (pago de gasto fijo), recurring_income (ingreso fijo) o receivable (cobro de Me deben)."
    ),
  limit: limitSchema,
  cursor: cursorSchema
})

export const listTransactions = defineTool({
  name: "list_transactions",
  group: "read",
  title: "Listar movimientos",
  description:
    "Ingresos y gastos del espacio, del más reciente al más antiguo (mismo orden que la tabla de Movimientos), con categoría, cuenta y vínculo. No incluye traspasos (usa list_transfers). Pagina con limit y next_cursor.",
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

    const innerDebt = args.linked === "debt" || args.linked === "receivable"
    let query = ctx.supabase
      .from("transactions")
      .select(transactionColumns(innerDebt))
      .eq("workspace_id", workspace.id)

    if (args.from) query = query.gte("occurred_on", args.from)
    if (args.to) query = query.lte("occurred_on", args.to)
    if (args.type) query = query.eq("type", args.type)
    if (args.category_id) query = query.eq("category_id", args.category_id)
    if (args.account_id) query = query.eq("account_id", args.account_id)
    if (args.search) {
      const pattern = quotePostgrestValue(`%${escapeLikePattern(args.search)}%`)
      query = query.or(`description.ilike.${pattern},note.ilike.${pattern}`)
    }

    switch (args.linked) {
      case "debt":
        query = query.in("debt_entries.debts.kind", ["credit_card", "loan"])
        break
      case "receivable":
        query = query.eq("debt_entries.debts.kind", "receivable")
        break
      case "recurring_expense":
        query = query.not("recurring_expense_id", "is", null)
        break
      case "recurring_income":
        query = query.not("recurring_income_id", "is", null)
        break
      case "none":
        query = query
          .is("recurring_expense_id", null)
          .is("recurring_income_id", null)
          .is("debt_entries", null)
        break
    }

    if (cursor) {
      query = query.or(afterCursorFilter(cursor))
    }

    // Una fila de más dice si hay otra página
    const { data, error } = await query
      .order("occurred_on", { ascending: false })
      .order("day_position", { ascending: true })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(args.limit + 1)

    if (error) {
      return toolError("No se pudieron cargar los movimientos.")
    }

    const rows = data as unknown as RawTransaction[]
    const page = rows.slice(0, args.limit)
    const last = page.at(-1)
    const nextCursor =
      rows.length > args.limit && last ? encodeCursor(last) : null

    return toolResult(
      `${page.length} movimientos en ${workspace.name}${nextCursor ? " (hay más: usa next_cursor)" : ""}.`,
      {
        workspace_id: workspace.id,
        transactions: page.map(toApiTransaction),
        next_cursor: nextCursor,
        currency: ctx.currency
      }
    )
  }
})
