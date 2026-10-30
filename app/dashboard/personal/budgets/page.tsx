import { ComingSoon } from "@/components/dashboard/coming-soon"
import { SITE } from "@/config/site"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Presupuestos",
  path: `${SITE.routes.dashboardPersonal}/budgets`,
  noindex: true
})

export default function BudgetsPage() {
  return (
    <ComingSoon
      title="Presupuestos"
      description="Límites de gasto por categoría."
    />
  )
}
