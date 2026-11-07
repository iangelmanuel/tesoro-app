import { z } from "zod"
import { isReceivableOverdue } from "@/features/debts/calculations"
import { getDebtEntries, getDebts } from "@/features/debts/queries"
import {
  INSTALLMENT_STATUS,
  receivableInstallments,
  summarizeInstallments
} from "@/features/debts/receivable-schedule"
import { currentMonth, monthRange, todayISO } from "@/libs/dates"
import { toolError, toolResult } from "../result"
import {
  PERSONAL_ONLY,
  defineTool,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"
import { monthInput } from "./report-helpers"

const input = z.object({
  workspace_id: workspaceIdSchema,
  month: monthInput
})

const round2 = (value: number) => Math.round(value * 100) / 100

export const listReceivables = defineTool({
  name: "list_receivables",
  group: "read",
  title: "Listar lo que te deben",
  description:
    "Cuentas por cobrar (Me deben) activas de un mes con lo esperado, lo cobrado y lo pendiente. En un cobro mensual es la cuota del mes (Pagada, Abonada, Pendiente o Atrasada) y lo atrasado de meses anteriores; en un cobro único, el total con su fecha esperada. Solo Personal.",
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

    const month = args.month ?? currentMonth()
    const { from: periodOn, to: monthEnd } = monthRange(month)
    const today = todayISO()

    const receivables = (await getDebts(workspace.id)).filter(
      (debt) => debt.kind === "receivable" && debt.status === "active"
    )

    const rows = await Promise.all(
      receivables.map(async (debt) => {
        const base = {
          id: debt.id,
          name: debt.name,
          counterparty: debt.counterparty
        }

        if (debt.schedule === "monthly") {
          const entries =
            debt.entries_count > 0 ? await getDebtEntries(debt.id) : []
          const installments = receivableInstallments(debt, entries, today)
          const installment = installments.find(
            (item) => item.period_on === periodOn
          )
          if (!installment) {
            return null
          }
          const summary = summarizeInstallments(installments, today)
          return {
            ...base,
            schedule: "monthly" as const,
            due_on: installment.due_on,
            expected: installment.expected,
            collected: installment.paid,
            pending: installment.remaining,
            status: installment.status,
            status_label: INSTALLMENT_STATUS[installment.status].label,
            overdue_installments: summary.overdueCount,
            owed_to_date: summary.owed
          }
        }

        // Cobro único: entra si se espera este mes o antes (o sin fecha)
        if (debt.expected_on !== null && debt.expected_on > monthEnd) {
          return null
        }
        return {
          ...base,
          schedule: "once" as const,
          expected_on: debt.expected_on,
          expected: round2(debt.balance + debt.paid_total),
          collected: debt.paid_total,
          pending: debt.balance,
          overdue: isReceivableOverdue(debt, today)
        }
      })
    )

    const items = rows.filter((row) => row !== null)
    const totals = items.reduce(
      (sum, row) => ({
        expected: round2(sum.expected + row.expected),
        collected: round2(sum.collected + row.collected),
        pending: round2(sum.pending + row.pending)
      }),
      { expected: 0, collected: 0, pending: 0 }
    )

    return toolResult(
      `${month}: te deben ${totals.pending} de ${totals.expected} esperados (${items.length} cuentas).`,
      {
        workspace_id: workspace.id,
        month,
        totals,
        receivables: items,
        currency: ctx.currency
      }
    )
  }
})
