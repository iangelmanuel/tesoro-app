import { ComingSoon } from "@/components/dashboard/coming-soon"
import { SITE } from "@/config/site"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Metas",
  path: `${SITE.routes.dashboardPersonal}/goals`,
  noindex: true
})

export default function GoalsPage() {
  return (
    <ComingSoon
      title="Metas"
      description="Tus metas de ahorro y su avance."
    />
  )
}
