import { z } from "zod"
import {
  RECURRING_FREQUENCIES,
  recurringExpenseSchema
} from "@/features/recurring-expenses/schemas"
import {
  RECURRING_EXPENSE_NOT_FOUND,
  createRecurringExpenseRecord,
  loadRecurringExpense,
  updateRecurringExpenseRecord
} from "@/features/recurring-expenses/service"
import { todayISO } from "@/libs/dates"
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
  entityCategory,
  habitualAccount,
  missingField,
  personalWorkspace,
  resolveEntity,
  schemaError,
  serviceError
} from "./entities"
import { accountNameSchema, categoryNameSchema } from "./references"

// Crear y editar gastos fijos desde el MCP (SPEC 44), con el servicio de las
// actions (recurring-expenses/service.ts). Solo Personal. Las ocurrencias
// salen de la frecuencia y el día, igual que en la app.

const MONTH_QUESTION = "¿En qué mes del año se paga? (1–12)"

const fields = {
  name: z.string().describe("Nombre (1–60 caracteres): Netflix, Arriendo…"),
  amount: z.number().describe("Monto de cada pago, positivo."),
  category_id: z
    .uuid({ error: "Elige una categoría" })
    .describe("Categoría de gasto (de list_categories)."),
  category: categoryNameSchema,
  frequency: z
    .enum(RECURRING_FREQUENCIES)
    .describe("monthly (cada mes) o yearly (una vez al año)."),
  day_of_month: z
    .number()
    .int()
    .describe(
      "Día de pago (1–31). En meses más cortos cae el último día del mes."
    ),
  month_of_year: z
    .number()
    .int()
    .nullable()
    .describe("Anual: mes de pago (1–12)."),
  starts_on: dateSchema.describe("Desde cuándo aplica, YYYY-MM-DD."),
  ends_on: dateSchema
    .nullable()
    .describe("Hasta cuándo aplica, YYYY-MM-DD. null = sin fin."),
  account_id: z
    .uuid({ error: "Elige una cuenta válida" })
    .nullable()
    .describe(
      "Cuenta habitual del pago (prellena la cuenta al pagar). null = ninguna."
    ),
  account: accountNameSchema
}

const createInput = z.object({
  workspace_id: workspaceIdSchema,
  ...z.object(fields).partial().shape,
  frequency: fields.frequency.optional().describe("Por defecto monthly."),
  starts_on: fields.starts_on.optional().describe("Por defecto hoy."),
  confirm_duplicate: confirmDuplicateSchema
})

export const createRecurringExpenseTool = defineTool({
  name: "create_recurring_expense",
  group: "write",
  title: "Crear gasto fijo",
  description: `Crea un gasto fijo (suscripción, arriendo, servicio) que se repite cada mes o cada año, con su categoría de gasto, día de pago y cuenta habitual opcional. Aparece en Gastos fijos con sus próximas fechas. Para pagar una ocurrencia usa pay_recurring_expense. Solo Personal. ${NEEDS_INPUT_HINT}`,
  input: createInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const resolved = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in resolved) {
      return resolved.error
    }
    const { workspace } = resolved
    const frequency = args.frequency ?? "monthly"

    const missing: MissingField[] = []
    if (!args.name?.trim()) {
      missing.push(missingField("name", "¿Cómo se llama el gasto fijo?"))
    }
    if (args.amount === undefined) {
      missing.push(missingField("amount", "¿De cuánto es cada pago?"))
    }
    if (args.day_of_month === undefined) {
      missing.push(
        missingField("day_of_month", "¿Qué día del mes se paga? (1–31)")
      )
    }
    if (frequency === "yearly" && args.month_of_year == null) {
      missing.push(missingField("month_of_year", MONTH_QUESTION))
    }
    const [category, account] = await Promise.all([
      entityCategory(ctx, workspace, args, "expense"),
      habitualAccount(ctx, workspace, args)
    ])
    if ("missing" in category) {
      missing.push(category.missing)
    }
    if ("missing" in account) {
      missing.push(account.missing)
    }
    const { data: active } = await ctx.supabase
      .from("recurring_expenses")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .eq("is_active", true)
    const duplicate = duplicateName(active ?? [], args.name, {
      label: "un gasto fijo activo",
      confirmed: args.confirm_duplicate
    })
    if (duplicate) {
      missing.push(duplicate)
    }
    if (missing.length > 0 || "missing" in category || "missing" in account) {
      return needsInput(missing)
    }

    const parsed = recurringExpenseSchema.safeParse({
      name: args.name,
      amount: args.amount,
      category_id: category.value,
      account_id: account.value ?? null,
      frequency,
      day_of_month: args.day_of_month,
      month_of_year: args.month_of_year ?? null,
      starts_on: args.starts_on ?? todayISO(),
      ends_on: args.ends_on ?? null
    })
    if (!parsed.success) {
      return schemaError(parsed.error)
    }

    const result = await createRecurringExpenseRecord(
      ctx.supabase,
      workspace,
      parsed.data
    )
    if (!result.ok) {
      return serviceError(result)
    }

    return commitEntity(ctx, {
      workspace,
      tool: "create_recurring_expense",
      table: "recurring_expenses",
      summary: `Gasto fijo "${result.after.name}" creado en ${workspace.name}`,
      before: null,
      after: result.after
    })
  }
})

const updateInput = z.object({
  workspace_id: workspaceIdSchema,
  recurring_expense_id: z
    .uuid({ error: RECURRING_EXPENSE_NOT_FOUND })
    .optional()
    .describe("Id del gasto fijo (de list_recurring)."),
  recurring_expense: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe("Nombre del gasto fijo, si no tienes el id."),
  ...z.object(fields).partial().shape
})

export const updateRecurringExpenseTool = defineTool({
  name: "update_recurring_expense",
  group: "write",
  title: "Editar gasto fijo",
  description: `Cambia nombre, monto, categoría, frecuencia, día, mes, fechas o cuenta habitual de un gasto fijo. Solo cambia los campos que envíes; los demás quedan igual. Los pagos ya registrados no cambian. Solo Personal. ${NEEDS_INPUT_HINT}`,
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
      amount: args.amount,
      category_id: args.category_id,
      category: args.category,
      frequency: args.frequency,
      day_of_month: args.day_of_month,
      month_of_year: args.month_of_year,
      starts_on: args.starts_on,
      ends_on: args.ends_on,
      account_id: args.account_id,
      account: args.account
    }
    if (definedKeys(patch).length === 0) {
      return toolError(NO_CHANGES)
    }

    let id = args.recurring_expense_id
    if (!id) {
      const { data } = await ctx.supabase
        .from("recurring_expenses")
        .select("id, name")
        .eq("workspace_id", workspace.id)
        .order("name", { ascending: true })
      const found = resolveEntity(data ?? [], {
        id: undefined,
        name: args.recurring_expense,
        field: "recurring_expense_id",
        label: "el gasto fijo"
      })
      if ("missing" in found) {
        return needsInput([found.missing])
      }
      id = found.value
    }

    const current = await loadRecurringExpense(ctx.supabase, workspace.id, id)
    if (!current) {
      return toolError(RECURRING_EXPENSE_NOT_FOUND)
    }

    const missing: MissingField[] = []
    const frequency = args.frequency ?? current.frequency
    const monthOfYear =
      args.month_of_year === undefined
        ? current.month_of_year
        : args.month_of_year
    if (frequency === "yearly" && monthOfYear === null) {
      missing.push(missingField("month_of_year", MONTH_QUESTION))
    }

    // Categoría y cuenta solo se resuelven si llegan
    let categoryId = current.category_id
    if (args.category_id !== undefined || args.category !== undefined) {
      const category = await entityCategory(ctx, workspace, args, "expense")
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

    const parsed = recurringExpenseSchema.safeParse({
      name: args.name ?? current.name,
      amount: args.amount ?? Number(current.amount),
      category_id: categoryId,
      account_id:
        account.value === undefined ? current.account_id : account.value,
      frequency,
      day_of_month: args.day_of_month ?? current.day_of_month,
      month_of_year: monthOfYear,
      starts_on: args.starts_on ?? current.starts_on,
      ends_on: args.ends_on === undefined ? current.ends_on : args.ends_on
    })
    if (!parsed.success) {
      return schemaError(parsed.error)
    }

    const result = await updateRecurringExpenseRecord(
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
      tool: "update_recurring_expense",
      table: "recurring_expenses",
      summary: `Gasto fijo "${result.after.name}" editado en ${workspace.name}`,
      before: result.before,
      after: result.after
    })
  }
})
