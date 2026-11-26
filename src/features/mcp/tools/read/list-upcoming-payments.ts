import { z } from "zod"
import { isReceivableOverdue } from "@/features/debts/calculations"
import { nextPayment } from "@/features/debts/next-payment"
import { getDebtEntries, getDebts } from "@/features/debts/queries"
import { receivableInstallments } from "@/features/debts/receivable-schedule"
import { getUpcomingPayments } from "@/features/recurring-expenses/queries"
import { getUpcomingIncomes } from "@/features/recurring-incomes/queries"
import { addDays, currentMonth, shiftMonth, todayISO } from "@/libs/dates"
import { toolError, toolResult } from "../result"
import {
  PERSONAL_ONLY,
  defineTool,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"

// Lo que viene en los próximos N días y lo vencido (SPEC 43): gastos fijos,
// cuotas de deuda, cobros de Me deben e ingresos fijos, con las mismas
// consultas y reglas de estado de sus páginas.

const MAX_DAYS = 90
const round2 = (value: number) => Math.round(value * 100) / 100

const input = z.object({
  workspace_id: workspaceIdSchema,
  days: z
    .number()
    .int()
    .min(1)
    .max(MAX_DAYS)
    .default(30)
    .describe(`Días hacia adelante (1–${MAX_DAYS}, por defecto 30).`)
})

type Kind =
  "recurring_expense" | "debt_payment" | "receivable" | "recurring_income"

interface Item {
  kind: Kind
  /** out = sale dinero; in = entra */
  direction: "out" | "in"
  id: string
  name: string
  due_on: string
  amount: number | null
}

/** Meses YYYY-MM desde el actual hasta el de `end` */
function monthsUntil(end: string) {
  const months = [currentMonth()]
  while (months[months.length - 1] < end.slice(0, 7)) {
    months.push(shiftMonth(months[months.length - 1], 1))
  }
  return months
}

export const listUpcomingPayments = defineTool({
  name: "list_upcoming_payments",
  group: "read",
  title: "Próximos pagos y cobros",
  description: `Lo que vence en los próximos días (por defecto 30, hasta ${MAX_DAYS}) y, aparte, lo vencido sin pagar: ocurrencias de gastos fijos, el próximo pago de cada tarjeta o préstamo, cuotas y cobros de Me deben, e ingresos fijos esperados. Cada fila dice si sale (out) o entra (in) dinero. Solo Personal.`,
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
    const end = addDays(today, args.days)
    const months = monthsUntil(end)

    // El mes actual trae también lo impago de meses anteriores
    const [expenses, incomes, debts] = await Promise.all([
      Promise.all(
        months.map((month, index) =>
          index === 0
            ? getUpcomingPayments(workspace.id)
            : getUpcomingPayments(workspace.id, month)
        )
      ),
      Promise.all(
        months.map((month, index) =>
          index === 0
            ? getUpcomingIncomes(workspace.id)
            : getUpcomingIncomes(workspace.id, month)
        )
      ),
      getDebts(workspace.id)
    ])

    const items: Item[] = []

    for (const payment of expenses.flat()) {
      if (payment.transactionId !== null) continue
      items.push({
        kind: "recurring_expense",
        direction: "out",
        id: payment.recurringExpenseId,
        name: payment.name,
        due_on: payment.dueOn,
        amount: payment.amount
      })
    }

    for (const income of incomes.flat()) {
      if (income.remaining <= 0) continue
      items.push({
        kind: "recurring_income",
        direction: "in",
        id: income.recurringIncomeId,
        name: income.name,
        due_on: income.dueOn,
        amount: round2(income.remaining)
      })
    }

    const overdueDebts = new Set<string>()
    for (const debt of debts) {
      if (debt.kind === "receivable" || debt.status !== "active") continue
      const payment = nextPayment(debt, today)
      if (!payment || payment.status === "paid") continue
      if (payment.status === "overdue") overdueDebts.add(debt.id)
      items.push({
        kind: "debt_payment",
        direction: "out",
        id: debt.id,
        name: debt.name,
        due_on: payment.dueOn,
        amount: payment.amount
      })
    }

    const receivables = debts.filter(
      (debt) => debt.kind === "receivable" && debt.status === "active"
    )
    await Promise.all(
      receivables.map(async (debt) => {
        if (debt.schedule !== "monthly") {
          if (debt.balance > 0 && debt.expected_on !== null) {
            items.push({
              kind: "receivable",
              direction: "in",
              id: debt.id,
              name: debt.name,
              due_on: debt.expected_on,
              amount: debt.balance
            })
          }
          return
        }
        const entries =
          debt.entries_count > 0 ? await getDebtEntries(debt.id) : []
        // Las cuotas llegan hasta el mes siguiente a `today`; las de más
        // adelante salen del cálculo a `end`, sin cobros todavía
        const current = receivableInstallments(debt, entries, today)
        const last = current.at(-1)?.period_on ?? ""
        const later = receivableInstallments(debt, entries, end).filter(
          (installment) => installment.period_on > last
        )
        for (const installment of [...current, ...later]) {
          if (installment.remaining <= 0) continue
          items.push({
            kind: "receivable",
            direction: "in",
            id: debt.id,
            name: debt.name,
            due_on: installment.due_on,
            amount: round2(installment.remaining)
          })
        }
      })
    )

    // Vencido: fecha antes de hoy (o un pago de deuda en estado Vencido)
    const isOverdue = (item: Item) =>
      item.due_on < today ||
      (item.kind === "debt_payment" && overdueDebts.has(item.id)) ||
      (item.kind === "receivable" &&
        receivables.some(
          (debt) =>
            debt.id === item.id &&
            debt.schedule !== "monthly" &&
            isReceivableOverdue(debt, today)
        ))
    const byDate = (a: Item, b: Item) => a.due_on.localeCompare(b.due_on)
    const overdue = items.filter(isOverdue).sort(byDate)
    const upcoming = items
      .filter((item) => !isOverdue(item) && item.due_on <= end)
      .sort(byDate)

    const sum = (list: Item[], direction: Item["direction"]) =>
      round2(
        list
          .filter((item) => item.direction === direction)
          .reduce((total, item) => total + (item.amount ?? 0), 0)
      )

    return toolResult(
      `${workspace.name}: ${overdue.length} vencidos y ${upcoming.length} en los próximos ${args.days} días (sale ${sum(upcoming, "out")}, entra ${sum(upcoming, "in")}).`,
      {
        workspace_id: workspace.id,
        from: today,
        to: end,
        overdue,
        upcoming,
        totals: {
          overdue_out: sum(overdue, "out"),
          overdue_in: sum(overdue, "in"),
          upcoming_out: sum(upcoming, "out"),
          upcoming_in: sum(upcoming, "in")
        },
        currency: ctx.currency
      }
    )
  }
})
