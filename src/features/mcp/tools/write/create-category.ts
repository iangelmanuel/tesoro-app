import { z } from "zod"
import {
  CATEGORY_COLOR_KEYS,
  CATEGORY_ICON_KEYS,
  TRANSACTION_TYPES
} from "@/features/categories/constants"
import { categorySchema } from "@/features/categories/schemas"
import { createCategoryRecord } from "@/features/categories/service"
import { commitOperation } from "../../operations"
import { toolError } from "../result"
import { defineTool, resolveWorkspace, workspaceIdSchema } from "../shared"
import {
  batchError,
  failureRowErrors,
  writeResult,
  zodRowErrors
} from "./batch"

// Icono y color por defecto si el agente no elige: claves del set curado
const DEFAULTS = {
  income: { icon: "coins", color: "emerald" },
  expense: { icon: "receipt", color: "rose" }
} as const

const input = z.object({
  workspace_id: workspaceIdSchema,
  name: z.string().describe("Nombre (1–40 caracteres), único por tipo."),
  type: z
    .enum(TRANSACTION_TYPES)
    .describe("income (ingreso) o expense (gasto)."),
  icon: z
    .enum(CATEGORY_ICON_KEYS)
    .optional()
    .describe("Icono opcional del set de Tesoro."),
  color: z
    .enum(CATEGORY_COLOR_KEYS)
    .optional()
    .describe("Color opcional de la paleta de Tesoro.")
})

export const createCategory = defineTool({
  name: "create_category",
  group: "write",
  title: "Crear categoría",
  description:
    "Crea una categoría propia del espacio (ingreso o gasto) para registrar movimientos en ella. Revisa antes list_categories: el nombre no puede repetirse en el mismo tipo. Devuelve el id y un operation_id para revertir.",
  input,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id, {
      writable: true
    })
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    const parsed = categorySchema.safeParse({
      name: args.name,
      type: args.type,
      icon: args.icon ?? DEFAULTS[args.type].icon,
      color: args.color ?? DEFAULTS[args.type].color
    })
    if (!parsed.success) {
      return batchError(zodRowErrors(0, parsed.error))
    }

    const result = await createCategoryRecord(
      ctx.supabase,
      workspace,
      parsed.data
    )
    if (!result.ok) {
      return batchError(failureRowErrors(0, result))
    }

    const summary = `Categoría "${result.after.name}" creada en ${workspace.name}`
    const operationId = await commitOperation(ctx, {
      workspaceId: workspace.id,
      tool: "create_category",
      summary,
      changes: [
        {
          table: "categories",
          rowId: result.after.id,
          before: null,
          after: result.after
        }
      ]
    })
    return writeResult(ctx, { operationId, summary, ids: [result.after.id] })
  }
})
