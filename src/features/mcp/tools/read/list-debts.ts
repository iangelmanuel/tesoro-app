import { z } from "zod"
import {
  PAYMENT_STATUS,
  nextPayment,
  utilizationPercent
} from "@/features/debts/calculations"
import { getDebts } from "@/features/debts/queries"
import { todayISO } from "@/libs/dates"
import { toolError, toolResult } from "../result"
import {
  PERSONAL_ONLY,
  defineTool,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"

const input = z.object({
  workspace_id: workspaceIdSchema,
  include_inactive: z
    .boolean()
    .default(false)
    .describe("Incluir deudas pagadas o archivadas.")
})

export const listDebts = defineTool({
  name: "list_debts",
  group: "read",
  title: "Listar deudas y tarjetas",
  description:
    "Tarjetas de crédito y préstamos con su saldo, como la página de Deudas: saldo, cupo y uso (tarjetas), cuota, tasa, próximo pago y su estado (Pagado, Pendiente, Hoy o Vencido). Lo que te deben está en list_receivables. Solo Personal.",
  input,
  annotations: { readOnlyHint: true },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }
    if (workspace.type !== "personal") {
      return toolError(PERSONAL_ONLY)
    }

    const today = todayISO()
    const debts = (await getDebts(workspace.id))
      .filter((debt) => debt.kind !== "receivable")
      .filter((debt) => args.include_inactive || debt.status === "active")
      .map((debt) => {
        const payment = nextPayment(debt, today)
        return {
          id: debt.id,
          name: debt.name,
          kind: debt.kind,
          status: debt.status,
          counterparty: debt.counterparty,
          balance: debt.balance,
          credit_limit: debt.credit_limit,
          utilization_percent:
            debt.kind === "credit_card" && debt.credit_limit
              ? utilizationPercent(debt.balance, debt.credit_limit)
              : null,
          installment: debt.installment,
          min_payment: debt.min_payment,
          interest_rate: debt.interest_rate,
          rate_type: debt.rate_type,
          paid_total: debt.paid_total,
          last_payment_on: debt.last_payment_on,
          // status null: tarjeta sin pago mínimo, solo fecha
          next_payment: payment
            ? {
                due_on: payment.dueOn,
                amount: payment.amount,
                status: payment.status,
                status_label: payment.status
                  ? PAYMENT_STATUS[payment.status].label
                  : null
              }
            : null
        }
      })

    const total = debts.reduce((sum, debt) => sum + debt.balance, 0)
    return toolResult(
      `${debts.length} deudas con saldo total de ${Math.round(total * 100) / 100}.`,
      { workspace_id: workspace.id, debts, currency: ctx.currency }
    )
  }
})
