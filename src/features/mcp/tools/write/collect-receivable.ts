import { z } from "zod"
import { debtPaymentDescriptions } from "@/features/debts/payment-description"
import {
  type ReceivableSchedule,
  receivableCollectSchema
} from "@/features/debts/receivable-schemas"
import { recordReceivableCollection } from "@/features/debts/receivable-service"
import { todayISO } from "@/libs/dates"
import { toolError } from "../result"
import {
  NEEDS_INPUT_HINT,
  dateSchema,
  defineTool,
  needsInput,
  workspaceIdSchema
} from "../shared"
import {
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

// collect_receivable (SPEC 43): cobrar lo que te deben

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

/** Cobro de Me deben: único o de una o varias cuotas */
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
