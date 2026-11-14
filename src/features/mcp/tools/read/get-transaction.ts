import { z } from "zod"
import { toolError, toolResult } from "../result"
import { defineTool, resolveWorkspace, workspaceIdSchema } from "../shared"
import {
  type RawTransaction,
  toApiTransaction,
  transactionColumns
} from "./transaction-row"

const NOT_FOUND = "No se encontró el movimiento."

const input = z.object({
  workspace_id: workspaceIdSchema,
  id: z.string().describe("Id del movimiento.")
})

export const getTransaction = defineTool({
  name: "get_transaction",
  group: "read",
  title: "Ver un movimiento",
  description:
    "Un ingreso o gasto por id, con su categoría, cuenta y vínculo (pago de deuda, avance de tarjeta, gasto fijo, ingreso fijo o cobro de Me deben).",
  input,
  annotations: { readOnlyHint: true },
  async run(ctx, { workspace_id, id }) {
    const workspace = await resolveWorkspace(ctx, workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }
    if (!z.uuid().safeParse(id).success) {
      return toolError(NOT_FOUND)
    }

    const { data, error } = await ctx.supabase
      .from("transactions")
      .select(transactionColumns(false))
      .eq("workspace_id", workspace.id)
      .eq("id", id)
      .maybeSingle()

    if (error) {
      return toolError("No se pudo cargar el movimiento.")
    }
    if (!data) {
      return toolError(NOT_FOUND)
    }

    const transaction = toApiTransaction(data as unknown as RawTransaction)
    return toolResult(
      `${transaction.type === "income" ? "Ingreso" : "Gasto"} de ${transaction.amount} el ${transaction.occurred_on}: ${transaction.description}.`,
      { workspace_id: workspace.id, transaction, currency: ctx.currency }
    )
  }
})
