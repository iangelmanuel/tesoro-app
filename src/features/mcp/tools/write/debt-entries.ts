import { z } from "zod"
import {
  type LoadedDebt,
  deleteEntryRecord,
  loadDebt,
  loadEntry,
  recordDebtPaymentRecord,
  recordReceivableCollection,
  updateDebtEntryRecord
} from "@/features/debts/entry-service"
import {
  ADJUSTMENT_DIRECTIONS,
  ENTRY_TYPES,
  entryTypeOf
} from "@/features/debts/entry-types"
import { debtPaymentDescriptions } from "@/features/debts/payment-description"
import { type Debt, getDebtEntry, getDebts } from "@/features/debts/queries"
import {
  type ReceivableSchedule,
  debtEntryEditSchema,
  paymentSchema,
  receivableCollectSchema
} from "@/features/debts/schemas"
import { todayISO } from "@/libs/dates"
import type { ServiceFailure } from "@/libs/service-result"
import { type OperationInput, commitOperation } from "../../operations"
import type { McpContext } from "../../types"
import { toolError } from "../result"
import {
  type McpWorkspace,
  NEEDS_INPUT_HINT,
  PERSONAL_ONLY,
  dateSchema,
  defineTool,
  needsInput,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"
import { failureRowErrors, timeInputSchema, writeResult } from "./batch"
import { debtChanges, snapshotDebtEntry } from "./debt-snapshots"
import {
  type RefOption,
  accountNameSchema,
  activeAccounts,
  resolveAccount
} from "./references"

// Pagos de deuda desde el MCP (SPEC 43): pagar una tarjeta o un préstamo,
// cobrar lo que te deben y editar o borrar un movimiento de una deuda. Usan
// los servicios de las actions (debts/entry-service.ts) y dejan en el log la
// deuda, el abono, sus movimientos y sus asignaciones para revertir.

const DEBT_NOT_FOUND = "No se encontró la deuda en este espacio."
const ENTRY_NOT_FOUND = "No se encontró el movimiento de la deuda."

const debtIdSchema = z
  .uuid({ error: DEBT_NOT_FOUND })
  .describe("Id de la deuda (de list_debts o list_receivables).")

const accountIdField = z
  .uuid({ error: "Elige una cuenta válida" })
  .nullable()
  .optional()

/** Espacio Personal con escritura */
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

/** La deuda con su saldo (servicio) y su resumen (descripciones, cuenta) */
async function findDebt(
  ctx: McpContext,
  workspace: McpWorkspace,
  debtId: string
): Promise<{ loaded: LoadedDebt; overview: Debt } | null> {
  const [loaded, debts] = await Promise.all([
    loadDebt(ctx.supabase, workspace.id, debtId),
    getDebts(workspace.id)
  ])
  const overview = debts.find((debt) => debt.id === debtId)
  return loaded && overview ? { loaded, overview } : null
}

/**
 * Cuenta del pago: la que llega (id, null o nombre) o la habitual de la
 * deuda si sigue activa. Sin ninguna se pregunta (con una sola cuenta activa
 * se usa esa).
 */
function paymentAccount(
  accounts: RefOption[],
  {
    id,
    name,
    habitual,
    label
  }: {
    id: string | null | undefined
    name: string | undefined
    habitual: string | null
    label: string
  }
) {
  if (
    id === undefined &&
    name === undefined &&
    habitual &&
    accounts.some((account) => account.id === habitual)
  ) {
    return { value: habitual }
  }
  return resolveAccount(accounts, {
    id,
    name,
    field: "account_id",
    label,
    nullable: true
  })
}

/** Error de un servicio, con sus campos */
function serviceError(failure: Pick<ServiceFailure, "error" | "fieldErrors">) {
  const errors = failureRowErrors(0, failure).map(({ field, message }) => ({
    ...(field ? { field } : {}),
    message
  }))
  return toolError(
    failure.error ?? errors[0]?.message ?? "No se pudo guardar.",
    { errors }
  )
}

function zodError(error: z.ZodError) {
  return serviceError({ fieldErrors: z.flattenError(error).fieldErrors })
}

async function commit(
  ctx: McpContext,
  operation: OperationInput,
  ids: string[]
) {
  const operationId = await commitOperation(ctx, operation)
  return writeResult(ctx, { operationId, summary: operation.summary, ids })
}

// record_debt_payment

const paymentInput = z.object({
  workspace_id: workspaceIdSchema,
  debt_id: debtIdSchema,
  amount: z.number().describe("Monto positivo."),
  occurred_on: dateSchema
    .optional()
    .describe("Fecha YYYY-MM-DD, no futura. Por defecto hoy."),
  time: timeInputSchema.optional().describe("Hora HH:MM, opcional."),
  account_id: accountIdField.describe(
    "Cuenta de la que sale el pago. Sin ella se usa la cuenta por defecto de la deuda; null = fuera de las cuentas."
  ),
  account: accountNameSchema.optional(),
  is_extra_payment: z
    .boolean()
    .default(false)
    .describe(
      "true: abono extra a capital; baja el saldo pero no cubre el pago del mes."
    ),
  create_transaction: z
    .boolean()
    .default(true)
    .describe(
      "Solo préstamos: registrar el gasto del pago (por defecto sí). Un pago de tarjeta no crea gasto."
    ),
  description: z
    .string()
    .optional()
    .describe(
      'Descripción del gasto. Por defecto la de la app: "Pago {deuda} · {mes}" o "Pago {deuda}" en un abono.'
    ),
  note: z.string().optional().describe("Nota opcional (hasta 120).")
})

export const recordDebtPayment = defineTool({
  name: "record_debt_payment",
  group: "write",
  title: "Pagar una deuda",
  description: `Registra un pago o un abono extra a una tarjeta de crédito o un préstamo, como el diálogo de pago: baja el saldo y, en un préstamo, crea el gasto en la cuenta. Fecha por defecto hoy y cuenta por defecto la habitual de la deuda. Para lo que te deben usa collect_receivable. Solo Personal. Devuelve un operation_id para revertir con undo_operation. ${NEEDS_INPUT_HINT}`,
  input: paymentInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const workspace = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }
    const found = await findDebt(ctx, workspace, args.debt_id)
    if (!found) {
      return toolError(DEBT_NOT_FOUND)
    }
    const { loaded, overview } = found
    if (loaded.kind === "receivable") {
      return toolError(
        "Esta deuda es de Me deben: regístrala con collect_receivable."
      )
    }

    const isCard = loaded.kind === "credit_card"
    const createTransaction = !isCard && args.create_transaction
    let accountId: string | null = null
    if (isCard || createTransaction) {
      const account = paymentAccount(await activeAccounts(ctx, workspace.id), {
        id: args.account_id,
        name: args.account,
        habitual: overview.account_id,
        label: "la cuenta de la que sale el pago"
      })
      if ("missing" in account) {
        return needsInput([account.missing])
      }
      accountId = account.value
    }

    const descriptions = debtPaymentDescriptions(overview)
    const parsed = paymentSchema.safeParse({
      amount: args.amount,
      occurred_on: args.occurred_on ?? todayISO(),
      occurred_time: args.time ?? "",
      note: args.note ?? "",
      description:
        args.description ??
        (args.is_extra_payment ? descriptions.extra : descriptions.payment),
      create_transaction: createTransaction,
      is_extra_payment: args.is_extra_payment,
      account_id: accountId ?? "",
      transfer_from: "",
      transfer_amount: ""
    })
    if (!parsed.success) {
      return zodError(parsed.error)
    }

    const before = await snapshotDebtEntry(ctx, {
      debtId: loaded.id,
      entryId: null
    })
    const result = await recordDebtPaymentRecord(
      ctx.supabase,
      loaded,
      parsed.data
    )
    if (!result.ok) {
      return serviceError(result)
    }
    const after = await snapshotDebtEntry(ctx, {
      debtId: loaded.id,
      entryId: result.entryId
    })

    const kind = args.is_extra_payment ? "Abono" : "Pago"
    return commit(
      ctx,
      {
        workspaceId: workspace.id,
        tool: "record_debt_payment",
        summary: `${kind} de ${parsed.data.amount} a ${loaded.name}`,
        changes: debtChanges(before, after)
      },
      [result.entryId]
    )
  }
})

// collect_receivable

const collectInput = z.object({
  workspace_id: workspaceIdSchema,
  debt_id: debtIdSchema,
  mode: z
    .enum(["partial", "full", "single", "allocate"])
    .optional()
    .describe(
      "Cobro único: partial (abono, por defecto) o full (todo el saldo). Mensual: allocate (reparte desde la cuota más antigua, por defecto) o single (una cuota, con period_on)."
    ),
  amount: z
    .number()
    .optional()
    .describe("Monto positivo. No aplica en full: se cobra el saldo."),
  period_on: dateSchema
    .optional()
    .describe("Solo en single: la cuota, primer día del mes (YYYY-MM-01)."),
  occurred_on: dateSchema
    .optional()
    .describe("Fecha YYYY-MM-DD, no futura. Por defecto hoy."),
  account_id: accountIdField.describe(
    "Cuenta a la que entra el dinero. Sin ella se usa la habitual; null = fuera de las cuentas."
  ),
  account: accountNameSchema.optional(),
  create_transaction: z
    .boolean()
    .default(true)
    .describe("Registrar el ingreso en la cuenta (por defecto sí)."),
  description: z
    .string()
    .optional()
    .describe('Descripción del ingreso. Por defecto "Cobro {nombre}".'),
  note: z.string().optional().describe("Nota opcional (hasta 120).")
})

export const collectReceivable = defineTool({
  name: "collect_receivable",
  group: "write",
  title: "Cobrar lo que te deben",
  description: `Registra un cobro de Me deben como el tab Me deben: en un cobro único, abono o pago completo; en uno mensual, una cuota o varios meses (el monto se reparte desde la cuota más antigua sin cobrar). Crea el ingreso en la cuenta (por defecto la habitual) con fecha de hoy. Solo Personal. Devuelve un operation_id para revertir con undo_operation. ${NEEDS_INPUT_HINT}`,
  input: collectInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const workspace = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }
    const found = await findDebt(ctx, workspace, args.debt_id)
    if (!found || found.loaded.kind !== "receivable") {
      return toolError("No se encontró la cuenta por cobrar en este espacio.")
    }
    const { loaded, overview } = found
    const schedule = (loaded.schedule ?? "once") as ReceivableSchedule

    let accountId: string | null = null
    if (args.create_transaction) {
      const account = paymentAccount(await activeAccounts(ctx, workspace.id), {
        id: args.account_id,
        name: args.account,
        habitual: overview.account_id,
        label: "la cuenta a la que entra el cobro"
      })
      if ("missing" in account) {
        return needsInput([account.missing])
      }
      accountId = account.value
    }

    const mode = args.mode ?? (schedule === "monthly" ? "allocate" : "partial")
    const parsed = receivableCollectSchema.safeParse({
      mode,
      amount: args.amount,
      period_on: args.period_on,
      occurred_on: args.occurred_on ?? todayISO(),
      note: args.note ?? "",
      description:
        args.description ?? debtPaymentDescriptions(overview).payment,
      create_transaction: args.create_transaction,
      account_id: accountId ?? ""
    })
    if (!parsed.success) {
      return zodError(parsed.error)
    }

    const before = await snapshotDebtEntry(ctx, {
      debtId: loaded.id,
      entryId: null
    })
    const result = await recordReceivableCollection(
      ctx.supabase,
      loaded,
      parsed.data
    )
    if (!result.ok) {
      return serviceError(result)
    }
    const after = await snapshotDebtEntry(ctx, {
      debtId: loaded.id,
      entryId: result.entryId
    })

    const amount =
      parsed.data.mode === "full" ? loaded.balance : parsed.data.amount
    return commit(
      ctx,
      {
        workspaceId: workspace.id,
        tool: "collect_receivable",
        summary: `Cobro de ${amount} de ${loaded.name}`,
        changes: debtChanges(before, after)
      },
      [result.entryId]
    )
  }
})

// update_debt_entry

const updateInput = z.object({
  workspace_id: workspaceIdSchema,
  entry_id: z
    .uuid({ error: ENTRY_NOT_FOUND })
    .describe("Id del movimiento de la deuda."),
  type: z
    .enum(ENTRY_TYPES)
    .optional()
    .describe(
      "payment (pago o cobro), extra (abono), purchase (compra), advance (avance a una cuenta), fee (cuota de manejo) o adjustment (ajuste). Depende de la deuda."
    ),
  amount: z.number().optional().describe("Monto positivo."),
  direction: z
    .enum(ADJUSTMENT_DIRECTIONS)
    .optional()
    .describe("Solo ajustes: up sube el saldo, down lo baja."),
  occurred_on: dateSchema.optional().describe("Fecha YYYY-MM-DD, no futura."),
  time: timeInputSchema.optional().describe("Hora HH:MM, o null sin hora."),
  note: z.string().nullable().optional().describe("Nota (hasta 120)."),
  account_id: accountIdField.describe(
    "Cuenta del pago o del avance; null = fuera de las cuentas."
  ),
  account: accountNameSchema.optional(),
  create_transaction: z
    .boolean()
    .optional()
    .describe("Préstamo y Me deben: si el pago lleva su gasto o ingreso."),
  description: z
    .string()
    .optional()
    .describe("Descripción del movimiento enlazado."),
  category_id: z
    .uuid({ error: "Elige una categoría válida" })
    .optional()
    .describe("Categoría del movimiento enlazado."),
  installments: z
    .number()
    .int()
    .nullable()
    .optional()
    .describe("Compra o avance: cuotas (1–48), o null sin cuotas."),
  link_transaction_id: z
    .uuid({ error: "Elige un movimiento válido" })
    .optional()
    .describe(
      "Un gasto o ingreso ya registrado que pasa a ser el de este pago, en vez de crear uno."
    )
})

export const updateDebtEntry = defineTool({
  name: "update_debt_entry",
  group: "write",
  title: "Editar un movimiento de deuda",
  description: `Edita un movimiento de una deuda como el editor de la app: tipo, monto, fecha, hora, nota, cuenta, movimiento enlazado, abono extra y cuotas. Envía solo lo que cambia. Cambiar la cuenta mueve también el movimiento enlazado. Solo Personal. Devuelve un operation_id para revertir con undo_operation. ${NEEDS_INPUT_HINT}`,
  input: updateInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const workspace = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }
    const entry = await loadEntry(ctx.supabase, workspace.id, args.entry_id)
    const current = entry ? await getDebtEntry(entry.id) : null
    if (!entry || !current) {
      return toolError(ENTRY_NOT_FOUND)
    }

    // Cuenta por id o nombre; sin ninguno, la actual
    let accountId = current.payment_account_id
    if (args.account_id !== undefined || args.account !== undefined) {
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

    const time =
      args.time === undefined
        ? (current.occurred_time?.slice(0, 5) ?? "")
        : (args.time ?? "")
    const installments =
      args.installments === undefined ? current.installments : args.installments
    const parsed = debtEntryEditSchema.safeParse({
      type: args.type ?? entryTypeOf(current),
      amount: args.amount ?? Math.abs(current.amount),
      direction:
        args.direction ??
        (current.kind === "adjustment"
          ? current.amount < 0
            ? "down"
            : "up"
          : ""),
      occurred_on: args.occurred_on ?? current.occurred_on,
      occurred_time: time,
      note: (args.note === undefined ? current.note : args.note) ?? "",
      account_id: accountId ?? "",
      create_transaction:
        args.create_transaction ??
        (current.kind !== "payment" || current.transaction_id !== null),
      description: args.description ?? current.description ?? "",
      category_id: args.category_id ?? current.category_id ?? "",
      installments: installments ?? "",
      link_transaction_id: args.link_transaction_id ?? ""
    })
    if (!parsed.success) {
      return zodError(parsed.error)
    }

    const snapshotIds = [args.link_transaction_id].filter(
      (id): id is string => id !== undefined
    )
    const before = await snapshotDebtEntry(ctx, {
      debtId: entry.debt_id,
      entryId: entry.id,
      transactionIds: snapshotIds
    })
    const result = await updateDebtEntryRecord(ctx.supabase, entry, parsed.data)
    if (!result.ok) {
      // Falta la cuenta que el tipo nuevo pide: se pregunta
      if (result.fieldErrors?.account_id && accountId === null) {
        const accounts = await activeAccounts(ctx, workspace.id)
        return needsInput([
          {
            field: "account_id",
            question: result.fieldErrors.account_id[0] ?? "¿Qué cuenta usamos?",
            options: accounts.map((account) => ({
              id: account.id,
              label: account.name
            }))
          }
        ])
      }
      return serviceError(result)
    }
    const after = await snapshotDebtEntry(ctx, {
      debtId: entry.debt_id,
      entryId: entry.id,
      transactionIds: [
        ...snapshotIds,
        ...before.transactions.keys(),
        ...(result.after.transaction_id ? [result.after.transaction_id] : [])
      ]
    })

    return commit(
      ctx,
      {
        workspaceId: workspace.id,
        tool: "update_debt_entry",
        summary: `Movimiento de ${entry.debt.name} editado`,
        changes: debtChanges(before, after)
      },
      [entry.id]
    )
  }
})

// delete_debt_entry

const deleteInput = z.object({
  workspace_id: workspaceIdSchema,
  entry_id: z
    .uuid({ error: ENTRY_NOT_FOUND })
    .describe("Id del movimiento de la deuda.")
})

export const deleteDebtEntry = defineTool({
  name: "delete_debt_entry",
  group: "write",
  title: "Borrar un movimiento de deuda",
  description:
    "Borra un pago, cobro, compra, avance, cuota de manejo o ajuste de una deuda, como la app: si tiene movimiento enlazado también se borra, y no puede dejar el saldo negativo. Solo Personal. Se puede deshacer con undo_operation durante 30 días.",
  input: deleteInput,
  annotations: { readOnlyHint: false, destructiveHint: true },
  async run(ctx, args) {
    const workspace = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }
    const entry = await loadEntry(ctx.supabase, workspace.id, args.entry_id)
    if (!entry) {
      return toolError(ENTRY_NOT_FOUND)
    }

    const before = await snapshotDebtEntry(ctx, {
      debtId: entry.debt_id,
      entryId: entry.id
    })
    const result = await deleteEntryRecord(ctx.supabase, entry)
    if (!result.ok) {
      return serviceError(result)
    }
    const after = await snapshotDebtEntry(ctx, {
      debtId: entry.debt_id,
      entryId: entry.id,
      transactionIds: [...before.transactions.keys()]
    })

    return commit(
      ctx,
      {
        workspaceId: workspace.id,
        tool: "delete_debt_entry",
        summary: `Movimiento de ${entry.debt.name} borrado`,
        changes: debtChanges(before, after)
      },
      [entry.id]
    )
  }
})
