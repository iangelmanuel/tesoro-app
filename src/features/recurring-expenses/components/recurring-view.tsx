import { CalendarClock, CircleCheck, Plus } from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import { CardHeading } from "@/components/dashboard/data/card-heading"
import { MonthNav } from "@/components/dashboard/data/month-nav"
import { CARD } from "@/components/dashboard/data/surface"
import {
  CardEmpty,
  EmptyState
} from "@/components/dashboard/feedback/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getAccountBalances } from "@/features/accounts/queries"
import { RECURRING_PATH } from "@/features/budgets/tabs"
import { getCategories } from "@/features/categories/queries"
import { ImportButton } from "@/features/imports/components/import-button"
import type { PersonalWorkspace } from "@/features/workspaces/queries"
import { parseRecurringMonth } from "../month"
import {
  getOverdueSummary,
  getRecurringExpenses,
  getRecurringStartMonth,
  getUpcomingPayments
} from "../queries"
import { OverdueIndicator } from "./overdue-indicator"
import { RecurringExpenseDialog } from "./recurring-expense-dialog"
import {
  RecurringExpensesList,
  RecurringExpensesListSkeleton
} from "./recurring-expenses-list"
import { UpcomingPayments } from "./upcoming-payments"
import { UpcomingPaymentsCardSkeleton } from "./upcoming-payments-card"

/**
 * Contenido de Gastos fijos: pagos del mes elegido (`?month`) y lista.
 * Servidor, sin título.
 */
export async function RecurringView({
  workspace,
  month: monthParam
}: {
  workspace: PersonalWorkspace
  /** `?month` crudo; se acota entre el gasto más antiguo y el mes actual */
  month: string | string[] | undefined
}) {
  // Se parsea tras leer la sesión: el mes por defecto usa new Date()
  const month = parseRecurringMonth(
    monthParam,
    await getRecurringStartMonth(workspace.id)
  )
  const [categories, expenses, payments, accounts, overdue] = await Promise.all(
    [
      getCategories(workspace.id),
      getRecurringExpenses(workspace.id),
      getUpcomingPayments(workspace.id, month.month),
      getAccountBalances(workspace.id),
      getOverdueSummary(workspace.id)
    ]
  )

  const createButton = (
    <RecurringExpenseDialog
      workspaceId={workspace.id}
      categories={categories}
      accounts={accounts}
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
  // Resumen del mes elegido: en el mes actual no cuentan los atrasados que
  // vienen de meses anteriores
  const monthPayments = payments.filter((payment) =>
    payment.dueOn.startsWith(month.month)
  )
  const expected = monthPayments.reduce((sum, row) => sum + row.amount, 0)
  const paid = monthPayments.reduce(
    (sum, row) => sum + (row.paidAmount ?? 0),
    0
  )

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {createButton}
        <ImportButton target="recurring_expenses" />
        {overdue.count > 0 && (
          <div className="md:ml-auto">
            <OverdueIndicator
              summary={overdue}
              currency={workspace.currency}
            />
          </div>
        )}
      </div>

      <section
        aria-label={
          month.isCurrent ? "Próximos pagos" : `Pagos de ${month.label}`
        }
        className={CARD}
        data-tour="recurring-upcoming"
      >
        <CardHeading
          title={month.isCurrent ? "Próximos pagos" : `Pagos de ${month.label}`}
          control={
            <MonthNav
              path={RECURRING_PATH}
              label={month.label}
              prev={month.prev}
              next={month.next}
              on="card"
            />
          }
        />
        <div className="flex flex-col gap-3">
          {monthPayments.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Pagado{" "}
              <Amount
                value={paid}
                currency={workspace.currency}
                className="font-medium text-foreground"
              />{" "}
              de{" "}
              <Amount
                value={expected}
                currency={workspace.currency}
              />
            </p>
          )}
          {payments.length === 0 && !month.isCurrent && (
            <CardEmpty
              icon={CalendarClock}
              message="Sin pagos en este mes"
              hint="Tus gastos fijos no vencían en este mes."
            />
          )}
          {isUpToDate && month.isCurrent && (
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
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Gastos fijos</h2>
        <RecurringExpensesList
          expenses={expenses}
          categories={categories}
          accounts={accounts}
          currency={workspace.currency}
        />
      </div>
    </>
  )
}

/**
 * Gastos fijos mientras carga: botones de arriba, la tarjeta de pagos del
 * mes (con su selector) y la tabla, con los mismos contenedores
 */
export function RecurringViewSkeleton() {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-11 w-44 rounded-4xl" />
        <Skeleton className="h-11 w-32 rounded-4xl" />
      </div>
      <UpcomingPaymentsCardSkeleton withMonth />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-32" />
        <RecurringExpensesListSkeleton />
      </div>
    </>
  )
}
