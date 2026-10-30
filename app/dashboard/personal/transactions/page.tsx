import { ComingSoon } from "@/components/dashboard/coming-soon"
import { SITE } from "@/config/site"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Movimientos",
  path: `${SITE.routes.dashboardPersonal}/transactions`,
  noindex: true
})

export default function TransactionsPage() {
  return (
    <ComingSoon
      title="Movimientos"
      description="Tus ingresos y gastos registrados."
    />
  )
}
