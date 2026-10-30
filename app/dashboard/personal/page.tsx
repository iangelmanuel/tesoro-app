import { ComingSoon } from "@/components/dashboard/coming-soon"
import { SITE } from "@/config/site"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Resumen",
  path: SITE.routes.dashboardPersonal,
  noindex: true
})

export default function SummaryPage() {
  return (
    <ComingSoon
      title="Resumen"
      description="Tu panorama financiero personal de un vistazo."
    />
  )
}
