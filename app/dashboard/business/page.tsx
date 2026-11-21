import { Suspense } from "react"
import type { Route } from "next"
import { redirect } from "next/navigation"
import { Building2 } from "lucide-react"
import {
  EmptyState,
  EmptyStateSkeleton
} from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import { SITE } from "@/config/site"
import { BusinessDialog } from "@/features/business/components/business-dialog"
import { workspaceBasePath } from "@/features/workspaces/paths"
import { getBusinessWorkspaces } from "@/features/workspaces/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Empresa",
  path: SITE.routes.dashboardBusiness,
  noindex: true
})

export default function BusinessPage() {
  return (
    // La sesión es dinámica: va dentro de Suspense
    <Suspense fallback={<EmptyStateSkeleton className="flex-1" />}>
      <BusinessContent />
    </Suspense>
  )
}

// Con empresa, lleva a la primera (hoy el límite es 1). Sin empresa, el
// estado vacío invita a crearla
async function BusinessContent() {
  const [business] = await getBusinessWorkspaces()

  if (business) {
    redirect(workspaceBasePath(business) as Route)
  }

  return (
    <EmptyState
      icon={Building2}
      title="Aún no tienes una empresa"
      description="Crea un espacio de Empresa para llevar las entradas y salidas de tu negocio, separadas de tus finanzas personales."
      className="flex-1"
    >
      <BusinessDialog trigger={<Button>Crear empresa</Button>} />
    </EmptyState>
  )
}
