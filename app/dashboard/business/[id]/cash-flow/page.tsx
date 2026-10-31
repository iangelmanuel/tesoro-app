import { ComingSoon } from "@/components/dashboard/coming-soon"
import { SITE } from "@/config/site"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Flujo de caja",
  path: SITE.routes.dashboardBusiness,
  noindex: true
})

export default function BusinessCashFlowPage() {
  return (
    <ComingSoon
      title="Flujo de caja"
      description="Entradas y salidas de plata de tu empresa, mes a mes."
    />
  )
}
