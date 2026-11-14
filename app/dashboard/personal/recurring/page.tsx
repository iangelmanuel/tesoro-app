import { Suspense } from "react"
import { Skeleton } from "@heroui/react"
import { CardSkeleton } from "@/components/dashboard/card-skeleton"
import { BudgetsAndRecurringTabs } from "@/features/budgets/components/budgets-and-recurring-tabs"
import { RECURRING_PATH } from "@/features/budgets/tabs"
import { RecurringView } from "@/features/recurring-expenses/components/recurring-view"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Gastos fijos",
  path: RECURRING_PATH,
  noindex: true
})

type RecurringPageProps = PageProps<"/dashboard/personal/recurring">

export default function RecurringPage({ searchParams }: RecurringPageProps) {
  return (
    <section
      aria-label="Gastos fijos"
      className="flex flex-1 flex-col gap-6"
    >
      {/* searchParams y la sesión son dinámicos: van dentro de Suspense */}
      <Suspense fallback={<RecurringSkeleton />}>
        <RecurringContent searchParams={searchParams} />
      </Suspense>
    </section>
  )
}

async function RecurringContent({
  searchParams
}: Pick<RecurringPageProps, "searchParams">) {
  const query = await searchParams
  const workspace = await getPersonalWorkspace()
  return (
    <BudgetsAndRecurringTabs tab="recurring">
      <RecurringView
        workspace={workspace}
        month={query.month}
      />
    </BudgetsAndRecurringTabs>
  )
}

function RecurringSkeleton() {
  return (
    <>
      <Skeleton className="h-10 w-48 rounded-3xl" />
      <CardSkeleton className="h-48" />
      <CardSkeleton className="h-96" />
    </>
  )
}
