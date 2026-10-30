import { ComingSoon } from "@/components/dashboard/coming-soon"
import { SITE } from "@/config/site"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Reportes",
  path: `${SITE.routes.dashboardPersonal}/reports`,
  noindex: true
})

export default function ReportsPage() {
  return (
    <ComingSoon
      title="Reportes"
      description="Gráficas y reportes de tus finanzas."
    />
  )
}
