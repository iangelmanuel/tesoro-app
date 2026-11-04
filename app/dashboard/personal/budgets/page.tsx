import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Button, Skeleton } from "@heroui/react"
import { PiggyBank, Plus } from "lucide-react"
import { CardSkeleton } from "@/components/dashboard/card-skeleton"
import { EmptyState } from "@/components/dashboard/empty-state"
import { SURFACE_LIST } from "@/components/dashboard/surface"
import { BudgetDialog } from "@/features/budgets/components/budget-dialog"
import { BudgetMonthNav } from "@/features/budgets/components/budget-month-nav"
import { BudgetProgressRow } from "@/features/budgets/components/budget-progress-row"
import { BudgetTotals } from "@/features/budgets/components/budget-totals"
import { CopyPreviousMonthButton } from "@/features/budgets/components/copy-previous-month-button"
import { UnbudgetedCategories } from "@/features/budgets/components/unbudgeted-categories"
import { type BudgetMonth, parseBudgetMonth } from "@/features/budgets/month"
import {
  type BudgetProgress,
  getBudgetProgress,
  hasBudgets
} from "@/features/budgets/queries"
import { BUDGETS_PATH, RECURRING_PATH } from "@/features/budgets/tabs"
import { getCategories } from "@/features/categories/queries"
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
    <section
      aria-label="Presupuestos"
      className="flex flex-1 flex-col gap-6"
    >
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
  // Enlaces antiguos (recomendaciones, notificaciones, marcadores)
  if (query.tab === "recurring") redirect(RECURRING_PATH)

  const workspace = await getPersonalWorkspace()

  return (
    <BudgetsView
      workspace={workspace}
      // Se parsea tras leer la sesión: el mes por defecto usa new Date()
      month={parseBudgetMonth(query.month)}
    />
  )
}

type BudgetedRow = BudgetProgress & { budgetId: string; budgetAmount: number }

function isBudgeted(row: BudgetProgress): row is BudgetedRow {
  return row.budgetId !== null && row.budgetAmount !== null
}

async function BudgetsView({
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
                  <Plus />
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
                  <Plus />
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
          <ul className={SURFACE_LIST}>
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

function BudgetsSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-56 rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        <CardSkeleton className="h-24" />
        <CardSkeleton className="h-24" />
        <CardSkeleton className="h-24" />
      </div>
      <CardSkeleton className="h-96" />
    </>
  )
}
