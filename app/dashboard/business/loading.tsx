import { EmptyStateSkeleton } from "@/components/dashboard/feedback/empty-state"
import { LoadingRegion } from "@/components/ui/skeleton"

// Carga de Empresa: el estado vacío o, con empresa, el paso a su Resumen
export default function BusinessLoading() {
  return (
    <LoadingRegion
      label="Cargando empresa…"
      className="flex flex-1 flex-col gap-6"
    >
      <EmptyStateSkeleton className="flex-1" />
    </LoadingRegion>
  )
}
