import { Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SITE } from "@/config/site"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Empresa",
  path: SITE.routes.dashboardBusiness,
  noindex: true
})

export default function BusinessPage() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Building2 className="size-6 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Aún no tienes una empresa
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Crea un espacio de Empresa para llevar el flujo de caja, las ventas y
          los costos de tu negocio, separados de tus finanzas personales.
        </p>
      </div>
      <Button disabled>Crear empresa</Button>
      <p className="text-xs text-muted-foreground">Disponible muy pronto</p>
    </section>
  )
}
