import { Suspense } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { BudgetsTabs } from "@/features/budgets/components/budgets-tabs"
import { BUDGETS_PATH, parseBudgetsTab } from "@/features/budgets/tabs"
import { getCategories } from "@/features/categories/queries"
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
        <p className="text-sm text-muted-foreground">
          Los presupuestos llegan en el siguiente paso.
        </p>
      )}
    </BudgetsTabs>
  )
}

async function RecurringTab({ workspace }: { workspace: PersonalWorkspace }) {
  const [categories, expenses, payments] = await Promise.all([
    getCategories(workspace.id),
    getRecurringExpenses(workspace.id),
    getUpcomingPayments(workspace.id)
  ])

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <RecurringExpenseDialog
          categories={categories}
          trigger={
            <Button>
              <Plus data-icon="inline-start" />
              Nuevo gasto fijo
            </Button>
          }
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Próximos pagos</h2>
        <UpcomingPayments
          payments={payments}
          categories={categories}
          currency={workspace.currency}
        />
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
