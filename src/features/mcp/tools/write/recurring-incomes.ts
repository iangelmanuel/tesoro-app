import { z } from "zod"
import {
  BIWEEKLY_DEFAULT_DAYS,
  INCOME_FREQUENCIES,
  INTERVAL_DAYS_MAX,
  INTERVAL_DAYS_MIN,
  type IncomeFrequency,
  recurringIncomeSchema,
  usesDayOfMonth
} from "@/features/recurring-incomes/schemas"
import {
  RECURRING_INCOME_NOT_FOUND,
  createRecurringIncomeRecord,
  loadRecurringIncome,
  updateRecurringIncomeRecord
} from "@/features/recurring-incomes/service"
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
  enumOptions,
  habitualAccount,
  missingField,
  personalWorkspace,
  resolveEntity,
  schemaError,
  serviceError
} from "./entities"
import { accountNameSchema, categoryNameSchema } from "./references"

// Crear y editar ingresos fijos desde el MCP (SPEC 44), con el servicio de
// las actions (recurring-incomes/service.ts) y las frecuencias de SPEC 38.
// Solo Personal. Las ocurrencias salen de la frecuencia y sus días, igual
// que en la app.

// Mismas etiquetas que el diálogo de la app
const FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  yearly: "Anual",
  daily: "Diaria",
  every_n_days: "Cada N días",
  none: "Sin fecha fija"
}

const WEEKDAY_LABELS: Record<string, string> = {
  "1": "Lunes",
  "2": "Martes",
  "3": "Miércoles",
  "4": "Jueves",
  "5": "Viernes",
  "6": "Sábado",
  "7": "Domingo"
}

interface Schedule {
  frequency: IncomeFrequency
  day_of_month: number | null
  second_day_of_month: number | null
  day_of_week: number | null
  interval_days: number | null
  month_of_year: number | null
}

/** Los días que pide la frecuencia y no llegaron */
function scheduleMissing(schedule: Schedule): MissingField[] {
  const missing: MissingField[] = []
  if (schedule.frequency === "weekly" && schedule.day_of_week === null) {
    missing.push(
      missingField(
        "day_of_week",
        "¿Qué día de la semana llega?",
        enumOptions(WEEKDAY_LABELS)
      )
    )
  }
  if (usesDayOfMonth(schedule.frequency) && schedule.day_of_month === null) {
    missing.push(missingField("day_of_month", "¿Qué día del mes llega? (1–31)"))
  }
  if (schedule.frequency === "yearly" && schedule.month_of_year === null) {
    missing.push(
      missingField("month_of_year", "¿En qué mes del año llega? (1–12)")
    )
  }
  if (
    schedule.frequency === "every_n_days" &&
    schedule.interval_days === null
  ) {
    missing.push(
      missingField(
        "interval_days",
        `¿Cada cuántos días llega? (${INTERVAL_DAYS_MIN}–${INTERVAL_DAYS_MAX})`
      )
    )
  }
  return missing
}

/** Quincenal sin días: 15 y 30, como el diálogo de la app */
function withBiweeklyDefaults(schedule: Schedule): Schedule {
  if (schedule.frequency !== "biweekly") {
    return schedule
  }
  return {
    ...schedule,
    day_of_month: schedule.day_of_month ?? BIWEEKLY_DEFAULT_DAYS[0],
    second_day_of_month:
      schedule.second_day_of_month ?? BIWEEKLY_DEFAULT_DAYS[1]
  }
}

const day = (what: string) => z.number().int().nullable().describe(what)

const fields = {
  name: z.string().describe("Nombre (1–60 caracteres): Salario, Arriendo…"),
  amount: z
    .number()
    .describe(
      "Monto de cada pago, positivo. En quincenal, el de cada quincena."
    ),
  category_id: z
    .uuid({ error: "Elige una categoría" })
    .describe("Categoría de ingreso (de list_categories)."),
  category: categoryNameSchema,
  frequency: z
    .enum(INCOME_FREQUENCIES)
    .describe(
      "weekly, biweekly (quincenal), monthly, yearly, daily, every_n_days o none (sin fecha fija)."
    ),
  day_of_month: day(
    "Monthly, yearly: día de pago (1–31). Biweekly: primer día (por defecto 15)."
  ),
  second_day_of_month: day(
    "Biweekly: segundo día, posterior al primero (por defecto 30)."
  ),
  day_of_week: day("Weekly: día de la semana, 1 = lunes … 7 = domingo."),
  interval_days: day(
    `Every_n_days: cada cuántos días (${INTERVAL_DAYS_MIN}–${INTERVAL_DAYS_MAX}), contados desde starts_on.`
  ),
  month_of_year: day("Yearly: mes de pago (1–12)."),
  starts_on: dateSchema.describe("Desde cuándo aplica, YYYY-MM-DD."),
  ends_on: dateSchema
    .nullable()
    .describe("Hasta cuándo aplica, YYYY-MM-DD. null = sin fin."),
  account_id: z
    .uuid({ error: "Elige una cuenta válida" })
    .nullable()
    .describe("Cuenta por defecto a la que llega. null = ninguna."),
  account: accountNameSchema
}

const createInput = z.object({
  workspace_id: workspaceIdSchema,
  ...z.object(fields).partial().shape,
  starts_on: fields.starts_on.optional().describe("Por defecto hoy."),
  confirm_duplicate: confirmDuplicateSchema
})

export const createRecurringIncomeTool = defineTool({
  name: "create_recurring_income",
  group: "write",
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

export const updateRecurringIncomeTool = defineTool({
  name: "update_recurring_income",
  group: "write",
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
