import { z } from "zod"
import { recordDebtPaymentRecord } from "@/features/debts/entry-payment-service"
import { paymentSchema } from "@/features/debts/entry-schemas"
import { debtPaymentDescriptions } from "@/features/debts/payment-description"
import { todayISO } from "@/libs/dates"
import { toolError } from "../result"
import {
  NEEDS_INPUT_HINT,
  dateSchema,
  defineTool,
  needsInput,
  workspaceIdSchema
} from "../shared"
import { timeInputSchema } from "./batch"
import {
  DEBT_NOT_FOUND,
  accountIdField,
  commit,
  debtIdSchema,
  findDebt,
  personalWorkspace,
  serviceError,
  zodError
} from "./debt-entry-shared"
import { paymentAccount } from "./debt-entry-values"
import { debtChanges, snapshotDebtEntry } from "./debt-snapshots"
import { accountNameSchema, activeAccounts } from "./references"

// record_debt_payment (SPEC 43): pagar una tarjeta o un préstamo

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

/** Pago o abono extra a una tarjeta o un préstamo */
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
