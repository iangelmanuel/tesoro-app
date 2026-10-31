import { ComingSoon } from "@/components/dashboard/coming-soon"
import { SITE } from "@/config/site"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Recomendaciones",
  path: SITE.routes.dashboardBusiness,
  noindex: true
})

export default function BusinessRecommendationsPage() {
  return (
    <ComingSoon
      title="Recomendaciones"
      description="Sugerencias para mejorar las finanzas de tu negocio."
    />
  )
}
