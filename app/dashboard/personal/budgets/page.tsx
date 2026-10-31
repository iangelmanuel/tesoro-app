import { Suspense } from "react"
import { CalendarClock, PiggyBank, Plus } from "lucide-react"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getAccountBalances } from "@/features/accounts/queries"
import { BudgetDialog } from "@/features/budgets/components/budget-dialog"
import { BudgetMonthNav } from "@/features/budgets/components/budget-month-nav"
import { BudgetProgressRow } from "@/features/budgets/components/budget-progress-row"
import { BudgetTotals } from "@/features/budgets/components/budget-totals"
import { BudgetsTabs } from "@/features/budgets/components/budgets-tabs"
import { CopyPreviousMonthButton } from "@/features/budgets/components/copy-previous-month-button"
import { UnbudgetedCategories } from "@/features/budgets/components/unbudgeted-categories"
import { type BudgetMonth, parseBudgetMonth } from "@/features/budgets/month"
import {
  type BudgetProgress,
  getBudgetProgress,
  hasBudgets
} from "@/features/budgets/queries"
import { BUDGETS_PATH, parseBudgetsTab } from "@/features/budgets/tabs"
import { getCategories } from "@/features/categories/queries"
import { ImportButton } from "@/features/imports/components/import-button"
import { RecurringExpenseDialog } from "@/features/recurring-expenses/components/recurring-expense-dialog"
import { RecurringExpensesList } from "@/features/recurring-expenses/components/recurring-expenses-list"
import { UpcomingPayments } from "@/features/recurring-expenses/components/upcoming-payments"
import {
  getRecurringExpenses,
  getUpcomingPayments
} from "@/features/recurring-expenses/queries"
import {
  type PersonalWorkspace,
  getPersonalWorkspace
} from "@/features/workspaces/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Presupuestos",
  path: BUDGETS_PATH,
  noindex: true
})

type BudgetsPageProps = PageProps<"/dashboard/personal/budgets">

export default function BudgetsPage({ searchParams }: BudgetsPageProps) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Presupuestos</h1>
        <p className="text-sm text-muted-foreground">
          Planea tu mes: cuánto quieres gastar y qué pagos fijos tienes.
        </p>
      </header>
      {/* searchParams y la sesión son dinámicos: van dentro de Suspense */}
      <Suspense fallback={<BudgetsSkeleton />}>
        <BudgetsContent searchParams={searchParams} />
      </Suspense>
    </section>
  )
}

async function BudgetsContent({
  searchParams
}: Pick<BudgetsPageProps, "searchParams">) {
  const query = await searchParams
  const workspace = await getPersonalWorkspace()
  const tab = parseBudgetsTab(query.tab)

  return (
    <BudgetsTabs tab={tab}>
      {tab === "recurring" ? (
        <RecurringTab workspace={workspace} />
      ) : (
        <BudgetsTab
          workspace={workspace}
          // Se parsea tras leer la sesión: el mes por defecto usa new Date()
          month={parseBudgetMonth(query.month)}
        />
      )}
    </BudgetsTabs>
  )
}

type BudgetedRow = BudgetProgress & { budgetId: string; budgetAmount: number }

function isBudgeted(row: BudgetProgress): row is BudgetedRow {
  return row.budgetId !== null && row.budgetAmount !== null
}

async function BudgetsTab({
  workspace,
  month
}: {
  workspace: PersonalWorkspace
  month: BudgetMonth
}) {
  const [categories, progress] = await Promise.all([
    getCategories(workspace.id),
    getBudgetProgress(workspace.id, month.month)
  ])
  const budgets = progress.filter(isBudgeted)
  const unbudgeted = progress.filter((row) => !isBudgeted(row))
  // Solo se consulta cuando el mes no tiene presupuestos
  const canCopyPrevious =
    budgets.length === 0 && (await hasBudgets(workspace.id, month.prev))

  // El selector solo lista categorías de gasto activas sin presupuesto en el
  // mes
  const budgetedIds = new Set(budgets.map((row) => row.categoryId))
  const available = categories.filter(
    (category) =>
      category.type === "expense" &&
      category.archived_at === null &&
      !budgetedIds.has(category.id)
  )

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BudgetMonthNav month={month} />
        {/* Sin presupuestos las acciones van en el estado vacío */}
        {budgets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <CopyPreviousMonthButton month={month.month} />
            <BudgetDialog
              month={month}
              categories={available}
              trigger={
                <Button>
                  <Plus data-icon="inline-start" />
                  Nuevo presupuesto
                </Button>
              }
            />
          </div>
        )}
      </div>

      {budgets.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Aún no tienes presupuestos para este mes"
          description="Define cuánto quieres gastar como máximo en cada categoría y sigue tu avance durante el mes."
        >
          <div className="flex flex-wrap justify-center gap-2">
            <BudgetDialog
              month={month}
              categories={available}
              trigger={
                <Button>
                  <Plus data-icon="inline-start" />
                  Crear presupuesto
                </Button>
              }
            />
            {canCopyPrevious && <CopyPreviousMonthButton month={month.month} />}
          </div>
        </EmptyState>
      ) : (
        <>
          <BudgetTotals
            budgets={budgets}
            currency={workspace.currency}
          />
          <ul className="divide-y rounded-xl border">
            {budgets.map((budget) => (
              <BudgetProgressRow
                key={budget.budgetId}
                budget={budget}
                month={month}
                currency={workspace.currency}
              />
            ))}
          </ul>
        </>
      )}

      {unbudgeted.length > 0 && (
        <UnbudgetedCategories
          rows={unbudgeted}
          month={month}
          categories={available}
          currency={workspace.currency}
        />
      )}
    </>
  )
}

async function RecurringTab({ workspace }: { workspace: PersonalWorkspace }) {
  const [categories, expenses, payments, accounts] = await Promise.all([
    getCategories(workspace.id),
    getRecurringExpenses(workspace.id),
    getUpcomingPayments(workspace.id),
    getAccountBalances(workspace.id)
  ])

  const createButton = (
    <RecurringExpenseDialog
      categories={categories}
      trigger={
        <Button>
          <Plus data-icon="inline-start" />
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

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Próximos pagos</h2>
        {isUpToDate && (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            Estás al día con tus pagos
          </p>
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

function BudgetsSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-96 w-full" />
    </>
  )
}
