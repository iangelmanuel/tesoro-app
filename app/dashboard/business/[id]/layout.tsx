import { Suspense } from "react"
import { notFound } from "next/navigation"
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton"
import { BusinessDeleted } from "@/features/business/components/business-deleted"
import { getWorkspace } from "@/features/workspaces/queries"

// No es async: params y la sesión se leen dentro de Suspense, así el shell
// se prerenderiza (cacheComponents). Mientras valida la empresa no se sabe
// qué pantalla viene: el fallback es una superficie neutra que llena el área
export default function BusinessLayout({
  children,
  params
}: LayoutProps<"/dashboard/business/[id]">) {
  return (
    <Suspense
      fallback={
        <LoadingRegion
          label="Cargando empresa…"
          className="flex flex-1 flex-col"
        >
          <Skeleton className="min-h-96 flex-1 rounded-3xl" />
        </LoadingRegion>
      }
    >
      <BusinessGate params={params}>{children}</BusinessGate>
    </Suspense>
  )
}

// Un id ajeno, inexistente o del espacio Personal da 404. Si la empresa está
// programada para borrarse, ninguna de sus rutas se muestra
async function BusinessGate({
  params,
  children
}: Pick<LayoutProps<"/dashboard/business/[id]">, "params" | "children">) {
  const { id } = await params
  const workspace = await getWorkspace(id)

  if (workspace.type !== "business") {
    notFound()
  }
  if (workspace.deletionRequestedAt) {
    return (
      <BusinessDeleted
        workspaceId={workspace.id}
        name={workspace.name}
        deletionRequestedAt={workspace.deletionRequestedAt}
      />
    )
  }

  return children
}
