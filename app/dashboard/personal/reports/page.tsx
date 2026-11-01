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
    // El título lo pone el header del dashboard
    <section
      aria-label="Reportes"
      className="flex flex-1 flex-col gap-4"
    >
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
