import { Button, Card, CardContent } from "@heroui/react"
import { CalendarClock, CircleCheck, Plus } from "lucide-react"
import { CardHeading } from "@/components/dashboard/card-heading"
import { CardEmpty, EmptyState } from "@/components/dashboard/empty-state"
import { getAccountBalances } from "@/features/accounts/queries"
import { getCategories } from "@/features/categories/queries"
import { ImportButton } from "@/features/imports/components/import-button"
import type { PersonalWorkspace } from "@/features/workspaces/queries"
import { getRecurringExpenses, getUpcomingPayments } from "../queries"
import { RecurringExpenseDialog } from "./recurring-expense-dialog"
import { RecurringExpensesList } from "./recurring-expenses-list"
import { UpcomingPayments } from "./upcoming-payments"

/** Contenido de Gastos fijos: próximos pagos y lista. Servidor, sin título */
export async function RecurringView({
  workspace
}: {
  workspace: PersonalWorkspace
}) {
  const [categories, expenses, payments, accounts] = await Promise.all([
    getCategories(workspace.id),
    getRecurringExpenses(workspace.id),
    getUpcomingPayments(workspace.id),
    getAccountBalances(workspace.id)
  ])

  const createButton = (
    <RecurringExpenseDialog
      workspaceId={workspace.id}
      categories={categories}
      trigger={
        <Button data-tour="recurring-create">
          <Plus />
          Nuevo gasto fijo
        </Button>
      }
    />
  )

  if (expenses.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Agrega tus gastos fijos"
        description="Arriendo, servicios, suscripciones o seguros. Tesoro te muestra cuándo vencen y los tiene en cuenta en tus presupuestos."
      >
        {createButton}
        <ImportButton target="recurring_expenses" />
      </EmptyState>
    )
  }

  const isUpToDate = payments.every((payment) => payment.transactionId !== null)

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {createButton}
        <ImportButton target="recurring_expenses" />
      </div>

      <Card data-tour="recurring-upcoming">
        <CardHeading title="Próximos pagos" />
        <CardContent className="flex flex-col gap-3">
          {isUpToDate && (
            <CardEmpty
              icon={CircleCheck}
              message="Estás al día con tus pagos"
            />
          )}
          {/* Los pagados del mes siguen en la lista con su monto */}
          {payments.length > 0 && (
            <UpcomingPayments
              workspaceId={workspace.id}
              payments={payments}
              categories={categories}
              accounts={accounts}
              currency={workspace.currency}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Gastos fijos</h2>
        <RecurringExpensesList
          expenses={expenses}
          categories={categories}
          currency={workspace.currency}
        />
      </div>
    </>
  )
}
