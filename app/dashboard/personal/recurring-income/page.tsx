import { Suspense } from "react"
import { LoadingRegion } from "@/components/ui/skeleton"
import { SITE } from "@/config/site"
import {
  RecurringIncomeView,
  RecurringIncomeViewSkeleton
} from "@/features/recurring-incomes/components/recurring-income-view"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Ingresos fijos",
  path: SITE.routes.personalRecurringIncome,
  noindex: true
})

type RecurringIncomePageProps =
  PageProps<"/dashboard/personal/recurring-income">

export default function RecurringIncomePage({
  searchParams
}: RecurringIncomePageProps) {
  return (
    <section
      aria-label="Ingresos fijos"
      className="flex flex-1 flex-col gap-6"
    >
      {/* searchParams y la sesión son dinámicos: van dentro de Suspense */}
      <Suspense fallback={<RecurringIncomeSkeleton />}>
        <RecurringIncomeContent searchParams={searchParams} />
      </Suspense>
    </section>
  )
}

async function RecurringIncomeContent({
  searchParams
}: Pick<RecurringIncomePageProps, "searchParams">) {
  const query = await searchParams
  const workspace = await getPersonalWorkspace()
  return (
    <RecurringIncomeView
      workspace={workspace}
      month={query.month}
    />
  )
}

function RecurringIncomeSkeleton() {
  return (
    <LoadingRegion
      label="Cargando ingresos fijos…"
      className="flex flex-1 flex-col gap-6"
    >
      <RecurringIncomeViewSkeleton />
    </LoadingRegion>
  )
}
