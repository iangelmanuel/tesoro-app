import { z } from "zod"
import { recurringIncomeSchema } from "@/features/recurring-incomes/schemas"
import { createRecurringIncomeRecord } from "@/features/recurring-incomes/service"
import { todayISO } from "@/libs/dates"
import {
  type MissingField,
  NEEDS_INPUT_HINT,
  defineTool,
  needsInput,
  workspaceIdSchema
} from "../shared"
import {
  commitEntity,
  confirmDuplicateSchema,
  duplicateName,
  entityCategory,
  enumOptions,
  habitualAccount,
  missingField,
  personalWorkspace,
  schemaError,
  serviceError
} from "./entities"
import {
  FREQUENCY_LABELS,
  type Schedule,
  fields,
  scheduleMissing,
  withBiweeklyDefaults
} from "./recurring-income-fields"

// create_recurring_income (SPEC 44), con el servicio de las actions
// (recurring-incomes/service.ts). Solo Personal.

const createInput = z.object({
  workspace_id: workspaceIdSchema,
  ...z.object(fields).partial().shape,
  starts_on: fields.starts_on.optional().describe("Por defecto hoy."),
  confirm_duplicate: confirmDuplicateSchema
})

/** Crea un ingreso fijo */
export const createRecurringIncomeTool = defineTool({
  name: "create_recurring_income",
  group: "manage",
  title: "Crear ingreso fijo",
  description: `Crea un ingreso fijo (salario, arriendo que recibe, rendimiento) con su frecuencia, categoría de ingreso y cuenta por defecto opcional. Cada frecuencia pide sus días: weekly el día de la semana, biweekly dos días del mes, monthly y yearly el día (yearly también el mes), every_n_days el intervalo. Para registrar lo que llegó usa receive_recurring_income. Solo Personal. ${NEEDS_INPUT_HINT}`,
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
      missing.push(missingField("name", "¿Cómo se llama el ingreso fijo?"))
    }
    if (args.amount === undefined) {
      missing.push(missingField("amount", "¿De cuánto es cada pago?"))
    }
    let schedule: Schedule | null = null
    if (args.frequency === undefined) {
      missing.push(
        missingField(
          "frequency",
          "¿Cada cuánto llega?",
          enumOptions(FREQUENCY_LABELS)
        )
      )
    } else {
      schedule = withBiweeklyDefaults({
        frequency: args.frequency,
        day_of_month: args.day_of_month ?? null,
        second_day_of_month: args.second_day_of_month ?? null,
        day_of_week: args.day_of_week ?? null,
        interval_days: args.interval_days ?? null,
        month_of_year: args.month_of_year ?? null
      })
      missing.push(...scheduleMissing(schedule))
    }
    const [category, account] = await Promise.all([
      entityCategory(ctx, workspace, args, "income"),
      habitualAccount(ctx, workspace, args)
    ])
    if ("missing" in category) {
      missing.push(category.missing)
    }
    if ("missing" in account) {
      missing.push(account.missing)
    }
    const { data: active } = await ctx.supabase
      .from("recurring_incomes")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .eq("is_active", true)
    const duplicate = duplicateName(active ?? [], args.name, {
      label: "un ingreso fijo activo",
      confirmed: args.confirm_duplicate
    })
    if (duplicate) {
      missing.push(duplicate)
    }
    if (
      missing.length > 0 ||
      !schedule ||
      "missing" in category ||
      "missing" in account
    ) {
      return needsInput(missing)
    }

    const parsed = recurringIncomeSchema.safeParse({
      name: args.name,
      amount: args.amount,
      category_id: category.value,
      account_id: account.value ?? null,
      ...schedule,
      starts_on: args.starts_on ?? todayISO(),
      ends_on: args.ends_on ?? null
    })
    if (!parsed.success) {
      return schemaError(parsed.error)
    }

    const result = await createRecurringIncomeRecord(
      ctx.supabase,
      workspace,
      parsed.data
    )
    if (!result.ok) {
      return serviceError(result)
    }

    return commitEntity(ctx, {
      workspace,
      tool: "create_recurring_income",
      table: "recurring_incomes",
      summary: `Ingreso fijo "${result.after.name}" creado en ${workspace.name}`,
      before: null,
      after: result.after
    })
  }
})
