import { z } from "zod"
import { loadEntry } from "@/features/debts/debt-loader"
import { debtEntryEditSchema } from "@/features/debts/entry-schemas"
import { updateDebtEntryRecord } from "@/features/debts/entry-service"
import {
  ADJUSTMENT_DIRECTIONS,
  ENTRY_TYPES
} from "@/features/debts/entry-types"
import { getDebtEntry } from "@/features/debts/queries"
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
  ENTRY_NOT_FOUND,
  accountIdField,
  commit,
  personalWorkspace,
  serviceError,
  zodError
} from "./debt-entry-shared"
import { debtEntryEditValues } from "./debt-entry-values"
import { debtChanges, snapshotDebtEntry } from "./debt-snapshots"
import { accountNameSchema, activeAccounts, resolveAccount } from "./references"

// update_debt_entry (SPEC 43): editar un movimiento de una deuda

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

/** Edita un movimiento de deuda como el editor de la app */
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

    const parsed = debtEntryEditSchema.safeParse(
      debtEntryEditValues(current, args, accountId)
    )
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
