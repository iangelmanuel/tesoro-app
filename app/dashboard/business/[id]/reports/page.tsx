import { ComingSoon } from "@/components/dashboard/coming-soon"
import { SITE } from "@/config/site"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Reportes",
  path: SITE.routes.dashboardBusiness,
  noindex: true
})

export default function BusinessReportsPage() {
  return (
    <ComingSoon
      title="Reportes"
      description="Ventas, costos y utilidad de tu empresa en gráficas."
    />
  )
}
