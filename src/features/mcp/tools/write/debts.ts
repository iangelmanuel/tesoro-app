import { z } from "zod"
import { loadDebt } from "@/features/debts/entry-service"
import { DEBT_NOT_FOUND, RECEIVABLE_NOT_FOUND } from "@/features/debts/errors"
import {
  type DebtKind,
  RATE_TYPES,
  type ReceivableSchedule
} from "@/features/debts/schemas"
import {
  createDebtRecord,
  debtFieldsFor,
  loadDebtRow,
  parseDebtInput,
  updateDebtRecord
} from "@/features/debts/service"
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
import {
  NO_CHANGES,
  commitEntity,
  definedKeys,
  enumOptions,
  missingField,
  resolveEntity,
  serviceError
} from "./entities"
import { accountNameSchema, activeAccounts, resolveAccount } from "./references"

// Crear y editar deudas (tarjetas y préstamos) y cuentas por cobrar (Me
// deben) desde el MCP (SPEC 44), con el servicio de las actions
// (debts/service.ts). Solo Personal. Cada tipo valida con su esquema de la
// UI; un campo que no aplica al tipo vuelve como needs_input en vez de
// ignorarse en silencio.

const KIND_LABELS: Record<DebtKind, string> = {
  credit_card: "una tarjeta de crédito",
  loan: "un préstamo",
  receivable: "una cuenta por cobrar"
}

const SCHEDULE_LABELS: Record<ReceivableSchedule, string> = {
  once: "Cobro único",
  monthly: "Mes a mes"
}

const FIELD_LABELS: Record<string, string> = {
  name: "el nombre",
  counterparty: "la entidad o persona",
  opening_balance: "el saldo",
  credit_limit: "el cupo",
  due_day: "el día de pago",
  closing_day: "el día de corte",
  interest_rate: "la tasa de interés",
  rate_type: "el tipo de tasa",
  min_payment: "el pago mínimo",
  fee_amount: "la cuota de manejo",
  fee_day: "el día de cobro de la cuota de manejo",
  installment: "la cuota",
  original_amount: "el monto original",
  term_months: "el plazo",
  expected_on: "la fecha esperada de pago",
  starts_on: "la fecha de inicio"
}

/** Preguntas de los campos obligatorios al crear, por tipo */
const REQUIRED: Record<string, Record<string, string>> = {
  credit_card: {
    name: "¿Cómo se llama la tarjeta?",
    opening_balance: "¿Cuánto debes hoy en la tarjeta? (0 si nada)",
    credit_limit: "¿Cuál es el cupo de la tarjeta?",
    closing_day: "¿Qué día del mes es el corte de la tarjeta?",
    due_day: "¿Qué día del mes se paga la tarjeta?"
  },
  loan: {
    name: "¿Cómo se llama el préstamo?",
    opening_balance: "¿Cuánto debes hoy del préstamo?",
    installment: "¿De cuánto es la cuota mensual?",
    interest_rate: "¿Cuál es la tasa de interés? (0 si no tiene)",
    due_day: "¿Qué día del mes se paga la cuota?"
  },
  receivable_once: {
    name: "¿Cómo llamamos esta cuenta por cobrar?",
    opening_balance: "¿Cuánto te deben?"
  },
  receivable_monthly: {
    name: "¿Cómo llamamos esta cuenta por cobrar?",
    installment: "¿Cuánto te pagan cada mes?",
    due_day: "¿Qué día del mes te pagan?",
    starts_on: "¿Desde qué fecha empieza el cobro mensual? (YYYY-MM-DD)"
  }
}

function requiredKey(kind: DebtKind, schedule: ReceivableSchedule | null) {
  return kind === "receivable" ? `receivable_${schedule ?? "once"}` : kind
}

const amount = (what: string) => z.number().describe(what)
const day = (what: string) => z.number().int().describe(what)

const debtFields = {
  name: z.string().describe("Nombre (1–60 caracteres)."),
  counterparty: z
    .string()
    .describe("Banco, entidad o persona (hasta 60), opcional."),
  opening_balance: amount("Saldo que se debe hoy."),
  credit_limit: amount("Tarjeta: cupo total."),
  closing_day: day("Tarjeta: día de corte (1–31)."),
  due_day: day("Día de pago (1–31)."),
  interest_rate: z
    .number()
    .nullable()
    .describe(
      "Tasa de interés en %. Préstamo: obligatoria (0 si no tiene). Tarjeta: opcional."
    ),
  rate_type: z
    .enum(RATE_TYPES)
    .nullable()
    .describe("ea (efectiva anual) o mv (mes vencido). Va con la tasa."),
  min_payment: amount("Tarjeta: pago mínimo, opcional.").nullable(),
  fee_amount: amount(
    "Tarjeta: cuota de manejo mensual, opcional. Va con fee_day."
  ).nullable(),
  fee_day: day("Tarjeta: día de cobro de la cuota de manejo.").nullable(),
  installment: amount("Préstamo: cuota mensual."),
  original_amount: amount("Préstamo: monto prestado, opcional.").nullable(),
  term_months: z
    .number()
    .int()
    .nullable()
    .describe("Préstamo: plazo en meses (1–600), opcional.")
}

const receivableFields = {
  name: debtFields.name,
  counterparty: z.string().describe("Quién te debe (hasta 60), opcional."),
  opening_balance: amount("Cobro único: cuánto te deben."),
  expected_on: dateSchema
    .nullable()
    .describe("Cobro único: fecha esperada de pago YYYY-MM-DD, opcional."),
  installment: amount("Mes a mes: monto de cada mes."),
  due_day: day("Mes a mes: día de pago (1–31)."),
  starts_on: dateSchema.describe("Mes a mes: fecha de inicio YYYY-MM-DD."),
  term_months: z
    .number()
    .int()
    .nullable()
    .describe("Mes a mes: número de cuotas (1–600). null = indefinida.")
}

const accountFields = {
  account_id: z
    .uuid({ error: "Elige una cuenta válida" })
    .nullable()
    .optional()
    .describe(
      "Cuenta habitual de los pagos (prellena la cuenta al pagar). null = ninguna."
    ),
  account: accountNameSchema.optional()
}

/** Campos enviados que no aplican al tipo: se pregunta si se quitan */
function notApplicable(
  values: Record<string, unknown>,
  kind: DebtKind,
  schedule: ReceivableSchedule | null
): MissingField[] {
  const applies = new Set(debtFieldsFor(kind, schedule))
  const what =
    kind === "receivable" && schedule
      ? `${KIND_LABELS.receivable} (${SCHEDULE_LABELS[schedule].toLowerCase()})`
      : KIND_LABELS[kind]
  return definedKeys(values)
    .filter((key) => key in FIELD_LABELS && !applies.has(key))
    .map((key) =>
      missingField(
        key,
        `${capitalize(FIELD_LABELS[key])} no aplica a ${what}. ¿Lo quitamos o es otro tipo?`
      )
    )
}

/** Los valores de `args` para las claves de `shape` */
function valuesOf(args: Record<string, unknown>, shape: z.ZodRawShape) {
  return Object.fromEntries(Object.keys(shape).map((key) => [key, args[key]]))
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Solo los campos del tipo, con los vacíos opcionales en null */
function pickFields(
  values: Record<string, unknown>,
  kind: DebtKind,
  schedule: ReceivableSchedule | null
) {
  return Object.fromEntries(
    debtFieldsFor(kind, schedule).map((key) => [
      key,
      values[key] === undefined
        ? key === "counterparty"
          ? ""
          : null
        : values[key]
    ])
  )
}

/** Cuenta habitual: solo se resuelve si llega por id o por nombre */
async function habitualAccount(
  ctx: McpContext,
  workspace: McpWorkspace,
  args: { account_id?: string | null; account?: string }
): Promise<{ value: string | null | undefined } | { missing: MissingField }> {
  if (args.account === undefined && args.account_id === undefined) {
    return { value: undefined }
  }
  return resolveAccount(await activeAccounts(ctx, workspace.id), {
    id: args.account_id,
    name: args.account,
    field: "account_id",
    label: "la cuenta habitual",
    nullable: true
  })
}

async function personalWorkspace(
  ctx: McpContext,
  id: string
): Promise<{ error: ToolResult } | { workspace: McpWorkspace }> {
  const workspace = await resolveWorkspace(ctx, id, { writable: true })
  if ("error" in workspace) {
    return { error: toolError(workspace.error) }
  }
  if (workspace.type !== "personal") {
    return { error: toolError(PERSONAL_ONLY) }
  }
  return { workspace }
}

async function createEntity(
  ctx: McpContext,
  {
    workspace,
    kind,
    schedule,
    values,
    account,
    tool
  }: {
    workspace: McpWorkspace
    kind: DebtKind
    schedule: ReceivableSchedule | null
    values: Record<string, unknown>
    account: { account_id?: string | null; account?: string }
    tool: string
  }
) {
  const required = REQUIRED[requiredKey(kind, schedule)]
  const missing = [
    ...notApplicable(values, kind, schedule),
    ...Object.entries(required)
      .filter(([key]) => {
        const value = values[key]
        return (
          value === undefined ||
          value === null ||
          (typeof value === "string" && value.trim() === "")
        )
      })
      .map(([key, question]) => missingField(key, question))
  ]

  const habitual = await habitualAccount(ctx, workspace, account)
  if ("missing" in habitual) {
    missing.push(habitual.missing)
  }
  if (missing.length > 0 || "missing" in habitual) {
    return needsInput(missing)
  }

  const parsed = parseDebtInput(kind, schedule, {
    ...pickFields(values, kind, schedule),
    account_id: habitual.value ?? null
  })
  if (!parsed.success) {
    return serviceError({ ok: false, fieldErrors: parsed.fieldErrors })
  }

  const result = await createDebtRecord(
    ctx.supabase,
    workspace,
    kind,
    parsed.data
  )
  if (!result.ok) {
    return serviceError(result)
  }

  const noun = kind === "receivable" ? "Cuenta por cobrar" : "Deuda"
  return commitEntity(ctx, {
    workspace,
    tool,
    table: "debts",
    summary: `${noun} "${result.after.name}" creada en ${workspace.name}`,
    before: null,
    after: result.after
  })
}

async function updateEntity(
  ctx: McpContext,
  {
    workspace,
    id,
    name,
    receivable,
    values,
    account,
    tool
  }: {
    workspace: McpWorkspace
    id: string | undefined
    name: string | undefined
    receivable: boolean
    values: Record<string, unknown>
    account: { account_id?: string | null; account?: string }
    tool: string
  }
) {
  const notFound = receivable ? RECEIVABLE_NOT_FOUND : DEBT_NOT_FOUND
  if (
    definedKeys(values).length === 0 &&
    account.account_id === undefined &&
    account.account === undefined
  ) {
    return toolError(NO_CHANGES)
  }

  let debtId = id
  if (!debtId) {
    const query = ctx.supabase
      .from("debts")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .order("name", { ascending: true })
    const { data } = await (receivable
      ? query.eq("kind", "receivable")
      : query.neq("kind", "receivable"))
    const resolved = resolveEntity(data ?? [], {
      id: undefined,
      name,
      field: receivable ? "receivable_id" : "debt_id",
      label: receivable ? "la cuenta por cobrar" : "la deuda"
    })
    if ("missing" in resolved) {
      return needsInput([resolved.missing])
    }
    debtId = resolved.value
  }

  const [debt, current] = await Promise.all([
    loadDebt(ctx.supabase, workspace.id, debtId),
    loadDebtRow(ctx.supabase, workspace.id, debtId)
  ])
  if (!debt || !current || (debt.kind === "receivable") !== receivable) {
    return toolError(notFound)
  }

  const missing = notApplicable(values, debt.kind, debt.schedule)
  const habitual = await habitualAccount(ctx, workspace, account)
  if ("missing" in habitual) {
    missing.push(habitual.missing)
  }
  if (missing.length > 0 || "missing" in habitual) {
    return needsInput(missing)
  }

  // Lo guardado con los cambios encima: los campos omitidos quedan igual
  const stored = pickFields(
    current as unknown as Record<string, unknown>,
    debt.kind,
    debt.schedule
  )
  if (stored.counterparty === null) {
    stored.counterparty = ""
  }
  const defined = Object.fromEntries(
    definedKeys(values).map((key) => [key, values[key]])
  )
  const parsed = parseDebtInput(debt.kind, debt.schedule, {
    ...stored,
    ...defined,
    account_id:
      habitual.value === undefined ? current.account_id : habitual.value
  })
  if (!parsed.success) {
    return serviceError({ ok: false, fieldErrors: parsed.fieldErrors })
  }

  const result = await updateDebtRecord(ctx.supabase, debt, parsed.data)
  if (!result.ok) {
    return serviceError(result)
  }

  const noun = receivable ? "Cuenta por cobrar" : "Deuda"
  return commitEntity(ctx, {
    workspace,
    tool,
    table: "debts",
    summary: `${noun} "${result.after.name}" editada en ${workspace.name}`,
    before: result.before,
    after: result.after,
    related: result.history
      ? [
          {
            table: "receivable_installment_history",
            rowId: result.history.id,
            before: null,
            after: result.history
          }
        ]
      : []
  })
}

type ToolResult = ReturnType<typeof toolError>

// Deudas: tarjetas y préstamos

const DEBT_KIND_OPTIONS = enumOptions({
  credit_card: "Tarjeta de crédito",
  loan: "Préstamo"
})

const createDebtInput = z.object({
  workspace_id: workspaceIdSchema,
  kind: z
    .enum(["credit_card", "loan"])
    .optional()
    .describe("credit_card (tarjeta de crédito) o loan (préstamo)."),
  ...z.object(debtFields).partial().shape,
  ...accountFields
})

export const createDebtTool = defineTool({
  name: "create_debt",
  group: "write",
  title: "Crear deuda",
  description: `Crea una tarjeta de crédito o un préstamo en Deudas, con los campos del formulario de la app. Tarjeta: nombre, saldo de hoy, cupo, día de corte y día de pago (tasa, pago mínimo y cuota de manejo opcionales). Préstamo: nombre, saldo, cuota, tasa (0 si no tiene) y día de pago (monto original y plazo opcionales). Para lo que le deben al usuario usa create_receivable. Solo Personal. ${NEEDS_INPUT_HINT}`,
  input: createDebtInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const resolved = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in resolved) {
      return resolved.error
    }
    if (!args.kind) {
      return needsInput([
        missingField(
          "kind",
          "¿Es una tarjeta de crédito o un préstamo?",
          DEBT_KIND_OPTIONS
        )
      ])
    }

    return createEntity(ctx, {
      workspace: resolved.workspace,
      kind: args.kind,
      schedule: null,
      values: valuesOf(args, debtFields),
      account: args,
      tool: "create_debt"
    })
  }
})

const updateDebtInput = z.object({
  workspace_id: workspaceIdSchema,
  debt_id: z
    .uuid({ error: DEBT_NOT_FOUND })
    .optional()
    .describe("Id de la deuda (de list_debts)."),
  debt: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe("Nombre de la deuda, si no tienes el id."),
  ...z.object(debtFields).partial().shape,
  ...accountFields
})

export const updateDebtTool = defineTool({
  name: "update_debt",
  group: "write",
  title: "Editar deuda",
  description: `Cambia los datos de una tarjeta o un préstamo: nombre, cupo, corte, pago, tasa, cuota, plazo, cuota de manejo o cuenta habitual. Solo cambia los campos que envíes; el tipo no cambia. Para registrar pagos usa record_debt_payment. Solo Personal. ${NEEDS_INPUT_HINT}`,
  input: updateDebtInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const resolved = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in resolved) {
      return resolved.error
    }

    return updateEntity(ctx, {
      workspace: resolved.workspace,
      id: args.debt_id,
      name: args.debt,
      receivable: false,
      values: valuesOf(args, debtFields),
      account: args,
      tool: "update_debt"
    })
  }
})

// Me deben: cuentas por cobrar de cobro único o mes a mes (SPEC 28)

const createReceivableInput = z.object({
  workspace_id: workspaceIdSchema,
  schedule: z
    .enum(["once", "monthly"])
    .optional()
    .describe(
      "once: te pagan una vez (o por abonos). monthly: te pagan una cuota cada mes. Por defecto once."
    ),
  ...z.object(receivableFields).partial().shape,
  ...accountFields
})

export const createReceivableTool = defineTool({
  name: "create_receivable",
  group: "write",
  title: "Crear cuenta por cobrar",
  description: `Crea una cuenta por cobrar en Me deben: dinero que le deben al usuario. Cobro único (schedule once): nombre y monto, fecha esperada opcional. Mes a mes (monthly): nombre, monto mensual, día de pago y fecha de inicio; número de cuotas opcional (sin él es indefinida). El tipo de cobro no se puede cambiar después. Solo Personal. ${NEEDS_INPUT_HINT}`,
  input: createReceivableInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const resolved = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in resolved) {
      return resolved.error
    }

    return createEntity(ctx, {
      workspace: resolved.workspace,
      kind: "receivable",
      schedule: args.schedule ?? "once",
      values: valuesOf(args, receivableFields),
      account: args,
      tool: "create_receivable"
    })
  }
})

const updateReceivableInput = z.object({
  workspace_id: workspaceIdSchema,
  receivable_id: z
    .uuid({ error: RECEIVABLE_NOT_FOUND })
    .optional()
    .describe("Id de la cuenta por cobrar (de list_receivables)."),
  receivable: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe("Nombre de la cuenta por cobrar, si no tienes el id."),
  ...z.object(receivableFields).partial().shape,
  ...accountFields
})

export const updateReceivableTool = defineTool({
  name: "update_receivable",
  group: "write",
  title: "Editar cuenta por cobrar",
  description: `Cambia los datos de una cuenta por cobrar de Me deben. Solo cambia los campos que envíes. No cambia el tipo de cobro (único o mes a mes): envía solo los campos de su tipo. En una mensual indefinida, un monto nuevo deja los meses ya corridos con el anterior, como la app. Para registrar cobros usa collect_receivable. Solo Personal. ${NEEDS_INPUT_HINT}`,
  input: updateReceivableInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const resolved = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in resolved) {
      return resolved.error
    }

    return updateEntity(ctx, {
      workspace: resolved.workspace,
      id: args.receivable_id,
      name: args.receivable,
      receivable: true,
      values: valuesOf(args, receivableFields),
      account: args,
      tool: "update_receivable"
    })
  }
})
