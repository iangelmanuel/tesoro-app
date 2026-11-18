import { z } from "zod"
import {
  recurringPaymentValues,
  unpaidOccurrence
} from "@/features/recurring-expenses/payment"
import { getUpcomingPayments } from "@/features/recurring-expenses/queries"
import { getIncomeSources } from "@/features/recurring-incomes/queries"
import { incomeReceiptValues } from "@/features/recurring-incomes/receipt"
import { createTransactionSchema } from "@/features/transactions/schemas"
import { createTransactionRecord } from "@/features/transactions/service"
import { todayISO } from "@/libs/dates"
import { type RowChange, commitOperation } from "../../operations"
import type { McpContext } from "../../types"
import { toolError } from "../result"
import {
  type McpWorkspace,
  type MissingField,
  NEEDS_INPUT_HINT,
  PERSONAL_ONLY,
  dateSchema,
  defineTool,
  needsInput,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"
import { failureRowErrors, timeInputSchema, writeResult } from "./batch"
import {
  type RefOption,
  accountNameSchema,
  activeAccounts,
  activeCategories,
  resolveAccount,
  resolveCategory
} from "./references"

// Gastos e ingresos fijos desde el MCP (SPEC 43): pagar una ocurrencia de un
// gasto fijo y recibir un ingreso fijo. Prellenan igual que el diálogo de
// movimiento (recurring-expenses/payment.ts, recurring-incomes/receipt.ts)
// y crean el movimiento con createTransactionRecord.

/** Campos comunes del movimiento que se crea */
const movementFields = {
  amount: z
    .number()
    .optional()
    .describe("Monto positivo. Por defecto el del gasto o ingreso fijo."),
  occurred_on: dateSchema
    .optional()
    .describe("Fecha del movimiento YYYY-MM-DD. Por defecto hoy."),
  time: timeInputSchema.optional().describe("Hora HH:MM, opcional."),
  account_id: z
    .uuid({ error: "Elige una cuenta válida" })
    .nullable()
    .optional()
    .describe(
      "Cuenta. Por defecto la habitual del gasto o ingreso fijo; null = fuera de las cuentas."
    ),
  account: accountNameSchema.optional(),
  category_id: z
    .uuid({ error: "Elige una categoría" })
    .optional()
    .describe("Categoría. Por defecto la del gasto o ingreso fijo."),
  description: z
    .string()
    .optional()
    .describe("Descripción. Por defecto la de la app (SPEC 41)."),
  note: z.string().optional().describe("Nota opcional (hasta 500).")
}

type MovementArgs = {
  amount?: number
  occurred_on?: string
  time?: string | null
  account_id?: string | null
  account?: string
  category_id?: string
  description?: string
  note?: string
}

async function personalWorkspace(ctx: McpContext, id: string) {
  const workspace = await resolveWorkspace(ctx, id, { writable: true })
  if ("error" in workspace) {
    return workspace
  }
  if (workspace.type !== "personal") {
    return { error: PERSONAL_ONLY }
  }
  return workspace
}

/**
 * Cuenta y categoría del movimiento: lo que llega o lo prellenado. Sin
 * cuenta habitual ni cuenta se pregunta; sin categoría activa, también.
 */
async function resolveMovement(
  ctx: McpContext,
  workspace: McpWorkspace,
  args: MovementArgs,
  defaults: { account_id: string | null; category_id: string | null },
  type: "income" | "expense"
): Promise<
  | { missing: MissingField[] }
  | { account_id: string | null; category_id: string }
> {
  const [accounts, categories] = await Promise.all([
    activeAccounts(ctx, workspace.id),
    activeCategories(ctx, workspace)
  ])
  const account =
    args.account_id === undefined &&
    args.account === undefined &&
    defaults.account_id
      ? { value: defaults.account_id }
      : resolveAccount(accounts, {
          id: args.account_id,
          name: args.account,
          field: "account_id",
          label:
            type === "expense"
              ? "la cuenta de la que sale el pago"
              : "la cuenta a la que entra el ingreso",
          nullable: true
        })
  const category = resolveCategory(categories, {
    id: args.category_id ?? defaults.category_id ?? undefined,
    name: undefined,
    type
  })
  const missing = [account, category].flatMap((item) =>
    "missing" in item ? [item.missing] : []
  )
  return missing.length > 0
    ? { missing }
    : {
        account_id: "value" in account ? account.value : null,
        category_id: "value" in category ? (category.value ?? "") : ""
      }
}

function serviceError(failure: Parameters<typeof failureRowErrors>[1]) {
  const errors = failureRowErrors(0, failure).map(({ field, message }) => ({
    ...(field ? { field } : {}),
    message
  }))
  return toolError(
    failure.error ?? errors[0]?.message ?? "No se pudo guardar.",
    { errors }
  )
}

/** Movimiento creado y, en un ingreso fijo, sus asignaciones */
async function createdChanges(
  ctx: McpContext,
  transaction: { id: string } & object
): Promise<RowChange[]> {
  const { data } = await ctx.supabase
    .from("recurring_income_allocations")
    .select("*")
    .eq("transaction_id", transaction.id)
    .order("due_on")
  return [
    {
      table: "transactions",
      rowId: transaction.id,
      before: null,
      after: transaction
    },
    ...(data ?? []).map((row): RowChange => ({
      table: "recurring_income_allocations",
      rowId: row.id,
      before: null,
      after: row
    }))
  ]
}

// pay_recurring_expense

const payInput = z.object({
  workspace_id: workspaceIdSchema,
  recurring_expense_id: z
    .uuid({ error: "No se encontró el gasto fijo" })
    .describe("Id del gasto fijo (de list_recurring)."),
  due_on: dateSchema
    .optional()
    .describe(
      "Vencimiento de la ocurrencia que se paga. Por defecto la más antigua sin pagar."
    ),
  ...movementFields
})

export const payRecurringExpense = defineTool({
  name: "pay_recurring_expense",
  group: "write",
  title: "Pagar un gasto fijo",
  description: `Paga una ocurrencia de un gasto fijo como el tab Gasto fijo: por defecto la más antigua sin pagar (hasta el mes actual), con su monto, su categoría, la cuenta habitual, fecha de hoy y "Pago {nombre} · {mes}". Crea el gasto y marca la ocurrencia como pagada. Solo Personal. Devuelve un operation_id para revertir con undo_operation. ${NEEDS_INPUT_HINT}`,
  input: payInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const workspace = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    const payments = await getUpcomingPayments(workspace.id)
    const payment = unpaidOccurrence(
      payments,
      args.recurring_expense_id,
      args.due_on
    )
    if (!payment) {
      return toolError(
        args.due_on
          ? "Esa ocurrencia no existe o ya está pagada."
          : "Este gasto fijo no tiene ocurrencias sin pagar hasta este mes."
      )
    }

    const accounts = await activeAccounts(ctx, workspace.id)
    const defaults = recurringPaymentValues(
      payment,
      accounts.map((account) => ({ id: account.id, archived_at: null }))
    )
    const movement = await resolveMovement(
      ctx,
      workspace,
      args,
      defaults,
      "expense"
    )
    if ("missing" in movement) {
      return needsInput(movement.missing)
    }

    const parsed = createTransactionSchema.safeParse({
      type: "expense",
      amount: args.amount ?? defaults.amount,
      occurred_on: args.occurred_on ?? todayISO(),
      occurred_time: args.time ?? "",
      category_id: movement.category_id,
      description: args.description ?? defaults.description,
      note: args.note ?? "",
      account_id: movement.account_id ?? "",
      counterparty: "",
      invoice_ref: "",
      recurring_income_id: "",
      recurring_expense_id: payment.recurringExpenseId,
      recurring_due_on: payment.dueOn,
      transfer_from: "",
      transfer_amount: ""
    })
    if (!parsed.success) {
      return serviceError({
        fieldErrors: z.flattenError(parsed.error).fieldErrors
      })
    }

    const result = await createTransactionRecord(
      ctx.supabase,
      workspace,
      parsed.data
    )
    if (!result.ok) {
      return serviceError(result)
    }

    const summary = `${payment.name} (${payment.dueOn}) pagado`
    const operationId = await commitOperation(ctx, {
      workspaceId: workspace.id,
      tool: "pay_recurring_expense",
      summary,
      changes: await createdChanges(ctx, result.after)
    })
    return writeResult(ctx, { operationId, summary, ids: [result.after.id] })
  }
})

// receive_recurring_income

const receiveInput = z.object({
  workspace_id: workspaceIdSchema,
  recurring_income_id: z
    .uuid({ error: "No se encontró el ingreso fijo" })
    .describe("Id del ingreso fijo (de list_recurring)."),
  ...movementFields
})

export const receiveRecurringIncome = defineTool({
  name: "receive_recurring_income",
  group: "write",
  title: "Recibir un ingreso fijo",
  description: `Recibe un ingreso fijo como el tab Ingreso: crea el ingreso (por defecto el monto esperado, su categoría, la cuenta habitual, fecha de hoy y "Ingreso {nombre} · {periodo}") y la app lo reparte entre las ocurrencias desde la más antigua abierta, hasta 12 futuras (SPEC 38). Solo Personal. Devuelve un operation_id para revertir con undo_operation. ${NEEDS_INPUT_HINT}`,
  input: receiveInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const workspace = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    const sources = await getIncomeSources(workspace.id)
    const source = sources.find((item) => item.id === args.recurring_income_id)
    if (!source) {
      return toolError("No se encontró el ingreso fijo, o está pausado.")
    }

    const [accounts, categories] = await Promise.all([
      activeAccounts(ctx, workspace.id),
      activeCategories(ctx, workspace)
    ])
    const toOption = (item: RefOption) => ({ id: item.id, archived_at: null })
    const defaults = incomeReceiptValues(source, {
      categories: categories.map((item) => ({
        ...toOption(item),
        type: item.type
      })),
      accounts: accounts.map(toOption)
    })
    const movement = await resolveMovement(
      ctx,
      workspace,
      args,
      defaults,
      "income"
    )
    if ("missing" in movement) {
      return needsInput(movement.missing)
    }

    const parsed = createTransactionSchema.safeParse({
      type: "income",
      amount: args.amount ?? defaults.amount,
      occurred_on: args.occurred_on ?? todayISO(),
      occurred_time: args.time ?? "",
      category_id: movement.category_id,
      description: args.description ?? defaults.description,
      note: args.note ?? "",
      account_id: movement.account_id ?? "",
      counterparty: "",
      invoice_ref: "",
      recurring_income_id: source.id,
      recurring_expense_id: "",
      recurring_due_on: "",
      transfer_from: "",
      transfer_amount: ""
    })
    if (!parsed.success) {
      return serviceError({
        fieldErrors: z.flattenError(parsed.error).fieldErrors
      })
    }

    const result = await createTransactionRecord(
      ctx.supabase,
      workspace,
      parsed.data
    )
    if (!result.ok) {
      return serviceError(result)
    }

    const summary = `${source.name}: ingreso de ${parsed.data.amount} recibido`
    const operationId = await commitOperation(ctx, {
      workspaceId: workspace.id,
      tool: "receive_recurring_income",
      summary,
      changes: await createdChanges(ctx, result.after)
    })
    return writeResult(ctx, { operationId, summary, ids: [result.after.id] })
  }
})
