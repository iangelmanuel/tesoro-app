import { Suspense } from "react"
import type { Route } from "next"
import { redirect } from "next/navigation"
import { Button } from "@heroui/react"
import { Building2 } from "lucide-react"
import { CardSkeleton } from "@/components/dashboard/card-skeleton"
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
    <Suspense fallback={<CardSkeleton className="flex-1" />}>
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
    <section className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-default">
        <Building2 className="size-6 text-muted" />
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Aún no tienes una empresa
        </h1>
        <p className="max-w-md text-sm text-muted">
          Crea un espacio de Empresa para llevar las ventas, los costos y los
          gastos de tu negocio, separados de tus finanzas personales.
        </p>
      </div>
      <BusinessDialog trigger={<Button>Crear empresa</Button>} />
    </section>
  )
}
