import { ComingSoon } from "@/components/dashboard/coming-soon"
import { SITE } from "@/config/site"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Recomendaciones",
  path: `${SITE.routes.dashboardPersonal}/recommendations`,
  noindex: true
})

export default function RecommendationsPage() {
  return (
    <ComingSoon
      title="Recomendaciones"
      description="Sugerencias basadas en tus registros."
    />
  )
}
