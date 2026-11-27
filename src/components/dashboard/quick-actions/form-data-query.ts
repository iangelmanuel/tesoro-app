"use server"

import { isActiveDebt } from "@/features/debts/calculations"
import { debtPaymentDescriptions } from "@/features/debts/payment-description"
import { getDebtEntriesByDebt, getDebts } from "@/features/debts/queries"
import { toCollectableReceivable } from "@/features/debts/receivable-collect"
import { getGoals } from "@/features/goals/queries"
import { getUpcomingPayments } from "@/features/recurring-expenses/queries"
import { getIncomeSources } from "@/features/recurring-incomes/queries"
import type { PaymentTabsData } from "@/features/transactions/components/transaction-form-panels"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { todayISO } from "@/libs/dates"

/**
 * Datos de Personal que solo usan los formularios de los accesos rápidos
 * (SPEC 57): metas, deudas y cobros activos, gastos fijos sin pagar e
 * ingresos fijos. Antes viajaban en el layout en cada ruta; ahora se piden
 * al abrir el formulario o al pasar por su disparador. El espacio es el
 * Personal del usuario de la sesión y cada consulta pasa por RLS
 */
export async function loadQuickActionsFormData(): Promise<PaymentTabsData> {
  const personal = await getPersonalWorkspace()
  const [goals, debts, payments, incomeSources] = await Promise.all([
    getGoals(personal.id),
    getDebts(personal.id),
    getUpcomingPayments(personal.id),
    getIncomeSources(personal.id)
  ])

  // Cuentas por cobrar activas con sus abonos: las mensuales calculan sus
  // cuotas con ellos (tab "Me deben"). Tras leer la sesión: todayISO usa
  // new Date()
  const today = todayISO()
  const activeReceivables = debts.filter(
    (debt) => debt.kind === "receivable" && debt.status === "active"
  )
  const receivableEntries = await getDebtEntriesByDebt(
    activeReceivables
      .filter((debt) => debt.entries_count > 0)
      .map((debt) => debt.id)
  )

  return {
    goals: goals
      .filter((goal) => goal.status === "active")
      .map(({ id, name }) => ({ id, name })),
    debts: debts.filter(isActiveDebt).map((debt) => ({
      id: debt.id,
      kind: debt.kind,
      name: debt.name,
      account_id: debt.account_id,
      descriptions: debtPaymentDescriptions(debt, today)
    })),
    receivables: activeReceivables.map((debt) =>
      toCollectableReceivable(debt, receivableEntries.get(debt.id) ?? [], today)
    ),
    // Ocurrencias sin pagar: las vencidas quedan primero (orden de vencimiento)
    pendingPayments: payments.filter(
      (payment) => payment.transactionId === null
    ),
    incomeSources
  }
}
