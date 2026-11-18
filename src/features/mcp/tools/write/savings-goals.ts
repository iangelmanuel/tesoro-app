import { z } from "zod"
import {
  CATEGORY_COLOR_KEYS,
  CATEGORY_ICON_KEYS
} from "@/features/categories/constants"
import { GOAL_NOT_FOUND } from "@/features/goals/contribution-service"
import { goalSchema } from "@/features/goals/schemas"
import {
  createGoalRecord,
  loadGoalRow,
  updateGoalRecord
} from "@/features/goals/service"
import { toolError } from "../result"
import {
  type MissingField,
  NEEDS_INPUT_HINT,
  dateSchema,
  defineTool,
  needsInput,
  workspaceIdSchema
} from "../shared"
import {
  NO_CHANGES,
  commitEntity,
  confirmDuplicateSchema,
  definedKeys,
  duplicateName,
  missingField,
  personalWorkspace,
  resolveEntity,
  schemaError,
  serviceError
} from "./entities"

// Crear y editar metas de ahorro desde el MCP (SPEC 44), con el servicio de
// las actions (goals/service.ts). Solo Personal. Los aportes van por
// record_goal_contribution.

// Icono y color por defecto si el agente no elige: claves del set curado
const DEFAULT_ICON = "piggy-bank"
const DEFAULT_COLOR = "emerald"

const fields = {
  name: z.string().describe("Nombre de la meta (1–60 caracteres)."),
  target_amount: z.number().describe("Monto objetivo, positivo."),
  target_date: dateSchema
    .nullable()
    .describe("Fecha objetivo YYYY-MM-DD, posterior a hoy. null = sin fecha."),
  icon: z.enum(CATEGORY_ICON_KEYS).describe("Icono del set de Tesoro."),
  color: z.enum(CATEGORY_COLOR_KEYS).describe("Color de la paleta de Tesoro.")
}

const createInput = z.object({
  workspace_id: workspaceIdSchema,
  ...z.object(fields).partial().shape,
  confirm_duplicate: confirmDuplicateSchema
})

export const createGoalTool = defineTool({
  name: "create_goal",
  group: "write",
  title: "Crear meta",
  description: `Crea una meta de ahorro con su monto objetivo y fecha opcional (posterior a hoy). Para aportar o retirar usa record_goal_contribution. Solo Personal. ${NEEDS_INPUT_HINT}`,
  input: createInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const resolved = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in resolved) {
      return resolved.error
    }
    const { workspace } = resolved

    const missing: MissingField[] = []
    if (!args.name?.trim()) {
      missing.push(missingField("name", "¿Cómo se llama la meta?"))
    }
    if (args.target_amount === undefined) {
      missing.push(
        missingField("target_amount", "¿Cuánto quieres ahorrar en total?")
      )
    }
    const { data: active } = await ctx.supabase
      .from("savings_goals")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .eq("status", "active")
    const duplicate = duplicateName(active ?? [], args.name, {
      label: "una meta activa",
      confirmed: args.confirm_duplicate
    })
    if (duplicate) {
      missing.push(duplicate)
    }
    if (missing.length > 0) {
      return needsInput(missing)
    }

    const parsed = goalSchema().safeParse({
      name: args.name,
      target_amount: args.target_amount,
      target_date: args.target_date ?? null,
      icon: args.icon ?? DEFAULT_ICON,
      color: args.color ?? DEFAULT_COLOR
    })
    if (!parsed.success) {
      return schemaError(parsed.error)
    }

    const result = await createGoalRecord(ctx.supabase, workspace, parsed.data)
    if (!result.ok) {
      return serviceError(result)
    }

    return commitEntity(ctx, {
      workspace,
      tool: "create_goal",
      table: "savings_goals",
      summary: `Meta "${result.after.name}" creada en ${workspace.name}`,
      before: null,
      after: result.after
    })
  }
})

const updateInput = z.object({
  workspace_id: workspaceIdSchema,
  goal_id: z
    .uuid({ error: GOAL_NOT_FOUND })
    .optional()
    .describe("Id de la meta (de list_goals)."),
  goal: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe("Nombre de la meta, si no tienes el id."),
  ...z.object(fields).partial().shape
})

export const updateGoalTool = defineTool({
  name: "update_goal",
  group: "write",
  title: "Editar meta",
  description: `Cambia nombre, monto objetivo, fecha, icono o color de una meta de ahorro. Solo cambia los campos que envíes; los demás quedan igual. Una fecha nueva debe ser posterior a hoy. Lo ahorrado no cambia. Solo Personal. ${NEEDS_INPUT_HINT}`,
  input: updateInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const resolved = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in resolved) {
      return resolved.error
    }
    const { workspace } = resolved

    const patch = {
      name: args.name,
      target_amount: args.target_amount,
      target_date: args.target_date,
      icon: args.icon,
      color: args.color
    }
    if (definedKeys(patch).length === 0) {
      return toolError(NO_CHANGES)
    }

    let id = args.goal_id
    if (!id) {
      const { data } = await ctx.supabase
        .from("savings_goals")
        .select("id, name")
        .eq("workspace_id", workspace.id)
        .order("name", { ascending: true })
      const found = resolveEntity(data ?? [], {
        id: undefined,
        name: args.goal,
        field: "goal_id",
        label: "la meta"
      })
      if ("missing" in found) {
        return needsInput([found.missing])
      }
      id = found.value
    }

    const current = await loadGoalRow(ctx.supabase, workspace.id, id)
    if (!current) {
      return toolError(GOAL_NOT_FOUND)
    }

    // Una fecha ya pasada se conserva si no se cambia, como en la app
    const parsed = goalSchema(current.target_date).safeParse({
      name: patch.name ?? current.name,
      target_amount: patch.target_amount ?? Number(current.target_amount),
      target_date:
        patch.target_date === undefined
          ? current.target_date
          : patch.target_date,
      icon: patch.icon ?? current.icon,
      color: patch.color ?? current.color
    })
    if (!parsed.success) {
      return schemaError(parsed.error)
    }

    const result = await updateGoalRecord(
      ctx.supabase,
      workspace,
      id,
      parsed.data
    )
    if (!result.ok) {
      return serviceError(result)
    }

    return commitEntity(ctx, {
      workspace,
      tool: "update_goal",
      table: "savings_goals",
      summary: `Meta "${result.after.name}" editada en ${workspace.name}`,
      before: result.before,
      after: result.after
    })
  }
})
