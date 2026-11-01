import { Suspense } from "react"
import { SITE } from "@/config/site"
import {
  ReportsView,
  ReportsViewSkeleton
} from "@/features/reports/components/reports-view"
import { getWorkspace } from "@/features/workspaces/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Reportes",
  path: SITE.routes.dashboardBusiness,
  noindex: true
})

type BusinessReportsPageProps = PageProps<"/dashboard/business/[id]/reports">

export default function BusinessReportsPage({
  params,
  searchParams
}: BusinessReportsPageProps) {
  return (
    <section
      aria-label="Reportes"
      className="flex flex-1 flex-col gap-6"
    >
      {/* params, searchParams y la sesión son dinámicos: van dentro de Suspense */}
      <Suspense fallback={<ReportsViewSkeleton />}>
        <ReportsContent
          params={params}
          searchParams={searchParams}
        />
      </Suspense>
    </section>
  )
}

// El layout ya validó que la empresa es del usuario y no está marcada
async function ReportsContent({
  params,
  searchParams
}: BusinessReportsPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const workspace = await getWorkspace(id)

  return (
    <ReportsView
      workspace={workspace}
      searchParams={query}
    />
  )
}
