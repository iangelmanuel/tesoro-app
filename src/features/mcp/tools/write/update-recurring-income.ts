import { z } from "zod"
import { recurringIncomeSchema } from "@/features/recurring-incomes/schemas"
import {
  RECURRING_INCOME_NOT_FOUND,
  loadRecurringIncome,
  updateRecurringIncomeRecord
} from "@/features/recurring-incomes/service"
import { toolError } from "../result"
import {
  NEEDS_INPUT_HINT,
  defineTool,
  needsInput,
  workspaceIdSchema
} from "../shared"
import {
  NO_CHANGES,
  commitEntity,
  definedKeys,
  entityCategory,
  habitualAccount,
  personalWorkspace,
  resolveEntity,
  schemaError,
  serviceError
} from "./entities"
import {
  fields,
  scheduleMissing,
  withBiweeklyDefaults
} from "./recurring-income-fields"

// update_recurring_income (SPEC 44), con el servicio de las actions
// (recurring-incomes/service.ts). Solo Personal.

const updateInput = z.object({
  workspace_id: workspaceIdSchema,
  recurring_income_id: z
    .uuid({ error: RECURRING_INCOME_NOT_FOUND })
    .optional()
    .describe("Id del ingreso fijo (de list_recurring)."),
  recurring_income: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe("Nombre del ingreso fijo, si no tienes el id."),
  ...z.object(fields).partial().shape
})

/** Edita un ingreso fijo con los campos enviados */
export const updateRecurringIncomeTool = defineTool({
  name: "update_recurring_income",
  group: "manage",
  title: "Editar ingreso fijo",
  description: `Cambia nombre, monto, categoría, frecuencia, días, fechas o cuenta por defecto de un ingreso fijo. Solo cambia los campos que envíes; los demás quedan igual. Al cambiar la frecuencia envía los días que pide la nueva. Lo ya recibido no cambia. Solo Personal. ${NEEDS_INPUT_HINT}`,
  input: updateInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const resolved = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in resolved) {
      return resolved.error
    }
    const { workspace } = resolved

    const patch = Object.fromEntries(
      Object.keys(fields).map((key) => [
        key,
        (args as Record<string, unknown>)[key]
      ])
    )
    if (definedKeys(patch).length === 0) {
      return toolError(NO_CHANGES)
    }

    let id = args.recurring_income_id
    if (!id) {
      const { data } = await ctx.supabase
        .from("recurring_incomes")
        .select("id, name")
        .eq("workspace_id", workspace.id)
        .order("name", { ascending: true })
      const found = resolveEntity(data ?? [], {
        id: undefined,
        name: args.recurring_income,
        field: "recurring_income_id",
        label: "el ingreso fijo"
      })
      if ("missing" in found) {
        return needsInput([found.missing])
      }
      id = found.value
    }

    const current = await loadRecurringIncome(ctx.supabase, workspace.id, id)
    if (!current) {
      return toolError(RECURRING_INCOME_NOT_FOUND)
    }

    const keep = <T>(value: T | undefined, stored: T) =>
      value === undefined ? stored : value
    const schedule = withBiweeklyDefaults({
      frequency: keep(args.frequency, current.frequency),
      day_of_month: keep(args.day_of_month, current.day_of_month),
      second_day_of_month: keep(
        args.second_day_of_month,
        current.second_day_of_month
      ),
      day_of_week: keep(args.day_of_week, current.day_of_week),
      interval_days: keep(args.interval_days, current.interval_days),
      month_of_year: keep(args.month_of_year, current.month_of_year)
    })
    const missing = scheduleMissing(schedule)

    // Categoría y cuenta solo se resuelven si llegan
    let categoryId = current.category_id
    if (args.category_id !== undefined || args.category !== undefined) {
      const category = await entityCategory(ctx, workspace, args, "income")
      if ("missing" in category) {
        missing.push(category.missing)
      } else {
        categoryId = category.value
      }
    }
    const account = await habitualAccount(ctx, workspace, args)
    if ("missing" in account) {
      missing.push(account.missing)
    }
    if (missing.length > 0 || "missing" in account) {
      return needsInput(missing)
    }

    const parsed = recurringIncomeSchema.safeParse({
      name: args.name ?? current.name,
      amount: args.amount ?? Number(current.amount),
      category_id: categoryId,
      account_id: keep(account.value, current.account_id),
      ...schedule,
      starts_on: args.starts_on ?? current.starts_on,
      ends_on: keep(args.ends_on, current.ends_on)
    })
    if (!parsed.success) {
      return schemaError(parsed.error)
    }

    const result = await updateRecurringIncomeRecord(
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
      tool: "update_recurring_income",
      table: "recurring_incomes",
      summary: `Ingreso fijo "${result.after.name}" editado en ${workspace.name}`,
      before: result.before,
      after: result.after
    })
  }
})
