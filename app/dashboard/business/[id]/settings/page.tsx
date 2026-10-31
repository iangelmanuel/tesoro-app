import { Suspense } from "react"
import { notFound } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { SITE } from "@/config/site"
import { AccountSection } from "@/features/account/components/account-section"
import { BusinessForm } from "@/features/business/components/business-dialog"
import { DeleteBusinessDialog } from "@/features/business/components/delete-business-dialog"
import { getBusinessWorkspaces } from "@/features/workspaces/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Ajustes",
  path: SITE.routes.dashboardBusiness,
  noindex: true
})

type BusinessSettingsPageProps = PageProps<"/dashboard/business/[id]/settings">

export default function BusinessSettingsPage({
  params
}: BusinessSettingsPageProps) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Los datos de tu empresa.
        </p>
      </header>
      {/* params y la sesión son dinámicos: van dentro de Suspense */}
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent params={params} />
      </Suspense>
    </section>
  )
}

// El layout ya validó que la empresa es del usuario y no está marcada
async function SettingsContent({
  params
}: Pick<BusinessSettingsPageProps, "params">) {
  const { id } = await params
  const business = (await getBusinessWorkspaces()).find(
    (workspace) => workspace.id === id
  )

  if (!business) {
    notFound()
  }

  return (
    <>
      <AccountSection
        title="Datos de la empresa"
        description="El nombre se ve en el aside. El NIT y el sector son solo informativos."
      >
        {/* key: tras guardar, el formulario toma los datos nuevos */}
        <BusinessForm
          key={`${business.name}-${business.taxId}-${business.sector}`}
          business={{
            id: business.id,
            name: business.name,
            taxId: business.taxId,
            sector: business.sector
          }}
        />
      </AccountSection>

      <AccountSection
        title="Zona de peligro"
        description={`Programa el borrado de la empresa. Tienes ${SITE.workspaceDeletionGraceDays} días para restaurarla.`}
        destructive
      >
        <DeleteBusinessDialog
          business={{ id: business.id, name: business.name }}
        />
      </AccountSection>
    </>
  )
}

function SettingsSkeleton() {
  return (
    <>
      <Skeleton className="h-80" />
      <Skeleton className="h-32" />
    </>
  )
}
