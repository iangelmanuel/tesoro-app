import { ComingSoon } from "@/components/dashboard/coming-soon"
import { SITE } from "@/config/site"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Deudas",
  path: `${SITE.routes.dashboardPersonal}/debts`,
  noindex: true
})

export default function DebtsPage() {
  return (
    <ComingSoon
      title="Deudas"
      description="Tus deudas y tarjetas, y cómo vas pagándolas."
    />
  )
}
