import { z } from "zod"
import { SITE } from "@/config/site"
import { todayISO } from "@/libs/dates"
import { toolError, toolResult } from "../result"
import {
  dateSchema,
  defineTool,
  needsInput,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"
import {
  accountNameSchema,
  activeAccounts,
  resolveAccount
} from "../write/references"

// Saldo de una cuenta a una fecha y diferencia para conciliar (SPEC 21 y
// 43): account_balance_at, el mismo cálculo de la pantalla de Cuentas.

const round2 = (value: number) => Math.round(value * 100) / 100

const input = z.object({
  workspace_id: workspaceIdSchema,
  account_id: z
    .uuid({ error: "Elige una cuenta válida" })
    .optional()
    .describe("Cuenta (de list_accounts)."),
  account: accountNameSchema.optional(),
  date: dateSchema
    .optional()
    .describe(
      "Fecha YYYY-MM-DD del saldo (al cierre del día). Por defecto hoy."
    ),
  expected_balance: z
    .number()
    .optional()
    .describe(
      "Saldo real (del banco o del extracto) a esa fecha, para ver la diferencia."
    )
})

export const getAccountBalance = defineTool({
  name: "get_account_balance",
  group: "read",
  title: "Saldo de una cuenta",
  description:
    "Saldo de una cuenta en Tesoro al cierre de una fecha, como la pantalla de Cuentas. Con expected_balance devuelve la diferencia (real − Tesoro) para conciliar y si es grande (faltan movimientos). Si recibes status needs_input, pregunta al usuario y vuelve a llamar con los datos.",
  input,
  annotations: { readOnlyHint: true },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    const accounts = await activeAccounts(ctx, workspace.id)
    let accountId = args.account_id
    if (accountId === undefined) {
      const resolved = resolveAccount(accounts, {
        id: undefined,
        name: args.account,
        field: "account_id",
        label: "la cuenta",
        nullable: false
      })
      if ("missing" in resolved) {
        return needsInput([resolved.missing])
      }
      accountId = resolved.value ?? undefined
    }

    const { data: account } = await ctx.supabase
      .from("accounts")
      .select("id, name, archived_at")
      .eq("workspace_id", workspace.id)
      .eq("id", accountId ?? "")
      .maybeSingle()
    if (!account) {
      return toolError("No se encontró la cuenta en este espacio.")
    }

    const date = args.date ?? todayISO()
    const { data, error } = await ctx.supabase.rpc("account_balance_at", {
      p_account_id: account.id,
      p_on: date
    })
    if (error) {
      return toolError("No se pudo calcular el saldo.")
    }

    const balance = round2(Number(data))
    const expected = args.expected_balance
    const difference =
      expected === undefined ? null : round2(expected - balance)
    // Mismo aviso del diálogo Conciliar (SPEC 21)
    const warn =
      difference !== null &&
      (Math.abs(difference) > SITE.reconciliation.warnAmount ||
        Math.abs(difference) >
          (Math.abs(balance) * SITE.reconciliation.warnPercent) / 100)

    return toolResult(
      difference === null
        ? `${account.name} al ${date}: ${balance}.`
        : `${account.name} al ${date}: ${balance} en Tesoro contra ${expected} real (diferencia ${difference}).${warn ? " Parece que faltan movimientos." : ""}`,
      {
        account_id: account.id,
        name: account.name,
        archived: account.archived_at !== null,
        date,
        balance,
        expected_balance: expected ?? null,
        difference,
        missing_movements_warning: warn,
        currency: ctx.currency
      }
    )
  }
})
