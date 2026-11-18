import { z } from "zod"
import {
  GOAL_NOT_FOUND,
  loadGoal,
  recordGoalContributionRecord
} from "@/features/goals/contribution-service"
import { contributionSchema } from "@/features/goals/schemas"
import { todayISO } from "@/libs/dates"
import { commitOperation } from "../../operations"
import { toolError } from "../result"
import {
  NEEDS_INPUT_HINT,
  PERSONAL_ONLY,
  dateSchema,
  defineTool,
  needsInput,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"
import { failureRowErrors, timeInputSchema, writeResult } from "./batch"
import { accountNameSchema, activeAccounts, resolveAccount } from "./references"

// Aportes y retiros de metas desde el MCP (SPEC 43), con el servicio de las
// actions (goals/contribution-service.ts).

const input = z.object({
  workspace_id: workspaceIdSchema,
  goal_id: z
    .uuid({ error: GOAL_NOT_FOUND })
    .describe("Id de la meta (de list_goals)."),
  direction: z
    .enum(["in", "out"])
    .describe("in = aporte (sube el progreso); out = retiro (lo baja)."),
  amount: z.number().describe("Monto positivo."),
  occurred_on: dateSchema
    .optional()
    .describe("Fecha YYYY-MM-DD, no futura. Por defecto hoy."),
  time: timeInputSchema.optional().describe("Hora HH:MM, opcional."),
  account_id: z
    .uuid({ error: "Elige una cuenta válida" })
    .nullable()
    .optional()
    .describe(
      "Cuenta de la que sale el aporte o a la que vuelve el retiro. Opcional: sin ella no toca ninguna cuenta."
    ),
  account: accountNameSchema.optional(),
  note: z.string().optional().describe("Nota opcional (hasta 120).")
})

export const recordGoalContribution = defineTool({
  name: "record_goal_contribution",
  group: "write",
  title: "Aportar o retirar de una meta",
  description: `Registra un aporte (direction in) o un retiro (out) en una meta de ahorro activa, como la app: un retiro no puede pasar de lo ahorrado. La cuenta es opcional. Fecha por defecto hoy. Solo Personal. Devuelve un operation_id para revertir con undo_operation. ${NEEDS_INPUT_HINT}`,
  input,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id, {
      writable: true
    })
    if ("error" in workspace) {
      return toolError(workspace.error)
    }
    if (workspace.type !== "personal") {
      return toolError(PERSONAL_ONLY)
    }

    const goal = await loadGoal(ctx.supabase, workspace.id, args.goal_id)
    if (!goal) {
      return toolError(GOAL_NOT_FOUND)
    }

    // Cuenta opcional: solo se resuelve si llega por id o por nombre
    let accountId: string | null = null
    if (args.account !== undefined || args.account_id) {
      const account = resolveAccount(await activeAccounts(ctx, workspace.id), {
        id: args.account_id,
        name: args.account,
        field: "account_id",
        label: "la cuenta",
        nullable: true
      })
      if ("missing" in account) {
        return needsInput([account.missing])
      }
      accountId = account.value
    }

    const parsed = contributionSchema.safeParse({
      kind: args.direction === "in" ? "deposit" : "withdrawal",
      amount: args.amount,
      occurred_on: args.occurred_on ?? todayISO(),
      occurred_time: args.time ?? "",
      note: args.note ?? "",
      account_id: accountId ?? "",
      transfer_from: "",
      transfer_amount: ""
    })
    if (!parsed.success) {
      const errors = failureRowErrors(0, {
        fieldErrors: z.flattenError(parsed.error).fieldErrors
      }).map(({ field, message }) => ({ ...(field ? { field } : {}), message }))
      return toolError(errors[0]?.message ?? "Revisa los datos.", { errors })
    }

    const result = await recordGoalContributionRecord(
      ctx.supabase,
      goal,
      parsed.data
    )
    if (!result.ok) {
      const errors = failureRowErrors(0, result).map(({ field, message }) => ({
        ...(field ? { field } : {}),
        message
      }))
      return toolError(
        result.error ?? errors[0]?.message ?? "No se pudo guardar.",
        {
          errors
        }
      )
    }

    const { data: after } = await ctx.supabase
      .from("goal_contributions")
      .select("*")
      .eq("id", result.contributionId)
      .single()

    const verb = args.direction === "in" ? "Aporte" : "Retiro"
    const summary = `${verb} de ${args.amount} en ${goal.name}`
    const operationId = after
      ? await commitOperation(ctx, {
          workspaceId: workspace.id,
          tool: "record_goal_contribution",
          summary,
          changes: [
            {
              table: "goal_contributions",
              rowId: after.id,
              before: null,
              after
            }
          ]
        })
      : null
    return writeResult(ctx, {
      operationId,
      summary,
      ids: [result.contributionId]
    })
  }
})
