import { z } from "zod"
import { budgetSchema } from "@/features/budgets/schemas"
import { setBudgetRecord } from "@/features/budgets/service"
import { currentMonth } from "@/libs/dates"
import {
  type MissingField,
  NEEDS_INPUT_HINT,
  defineTool,
  monthSchema,
  needsInput,
  workspaceIdSchema
} from "../shared"
import {
  commitEntity,
  entityCategory,
  missingField,
  personalWorkspace,
  schemaError,
  serviceError
} from "./entities"
import { categoryNameSchema } from "./references"

// Presupuesto de una categoría en un mes desde el MCP (SPEC 44), con el
// servicio de la action (budgets/service.ts). Crea o cambia el monto: hay
// uno por categoría y mes. Los presupuestos solo existen en Personal.

const input = z.object({
  workspace_id: workspaceIdSchema,
  category_id: z
    .uuid({ error: "Elige una categoría" })
    .optional()
    .describe("Categoría de gasto (de list_categories)."),
  category: categoryNameSchema.optional(),
  month: monthSchema.optional().describe("Mes YYYY-MM. Por defecto el actual."),
  amount: z.number().optional().describe("Monto del presupuesto, positivo.")
})

export const setBudgetTool = defineTool({
  name: "set_budget",
  group: "manage",
  title: "Fijar presupuesto",
  description: `Crea el presupuesto de una categoría de gasto para un mes o, si ya existe, cambia su monto (nunca duplica). Revisa list_budgets para ver los del mes. Solo Personal. Devuelve un operation_id para revertir. ${NEEDS_INPUT_HINT}`,
  input,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const resolved = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in resolved) {
      return resolved.error
    }
    const { workspace } = resolved

    const missing: MissingField[] = []
    if (args.amount === undefined) {
      missing.push(
        missingField("amount", "¿De cuánto es el presupuesto del mes?")
      )
    }
    const category = await entityCategory(ctx, workspace, args, "expense")
    if ("missing" in category) {
      missing.push(category.missing)
    }
    if (missing.length > 0 || "missing" in category) {
      return needsInput(missing)
    }

    const month = args.month ?? currentMonth()
    const parsed = budgetSchema.safeParse({
      category_id: category.value,
      month: `${month}-01`,
      amount: args.amount
    })
    if (!parsed.success) {
      return schemaError(parsed.error)
    }

    const result = await setBudgetRecord(ctx.supabase, workspace, parsed.data)
    if (!result.ok) {
      return serviceError(result)
    }

    const { data: categoryRow } = await ctx.supabase
      .from("categories")
      .select("name")
      .eq("id", result.after.category_id)
      .maybeSingle()
    const name = categoryRow?.name ?? "la categoría"
    return commitEntity(ctx, {
      workspace,
      tool: "set_budget",
      table: "budgets",
      summary: result.before
        ? `Presupuesto de ${name} en ${month} cambiado`
        : `Presupuesto de ${name} en ${month} creado`,
      before: result.before,
      after: result.after
    })
  }
})
