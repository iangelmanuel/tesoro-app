import { Suspense } from "react"
import {
  ReportsView,
  ReportsViewSkeleton
} from "@/features/reports/components/reports-view"
import { REPORTS_PATH } from "@/features/reports/period"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Reportes",
  path: REPORTS_PATH,
  noindex: true
})

type ReportsPageProps = PageProps<"/dashboard/personal/reports">

export default function ReportsPage({ searchParams }: ReportsPageProps) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Tus ingresos, gastos y categorías en el periodo que elijas.
        </p>
      </header>
      {/* searchParams y la sesión son dinámicos: van dentro de Suspense */}
      <Suspense fallback={<ReportsViewSkeleton />}>
        <ReportsContent searchParams={searchParams} />
      </Suspense>
    </section>
  )
}

async function ReportsContent({
  searchParams
}: Pick<ReportsPageProps, "searchParams">) {
  const query = await searchParams
  const workspace = await getPersonalWorkspace()

  return (
    <ReportsView
      workspace={{ ...workspace, type: "personal" }}
      searchParams={query}
    />
  )
}
