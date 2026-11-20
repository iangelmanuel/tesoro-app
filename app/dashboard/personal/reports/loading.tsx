import { LoadingRegion } from "@/components/ui/skeleton"
import { ReportsViewSkeleton } from "@/features/reports/components/reports-view"

// Carga de Reportes: los skeletons de la pantalla, con su mismo contenedor
export default function ReportsLoading() {
  return (
    <LoadingRegion
      label="Cargando reportes…"
      className="flex flex-1 flex-col gap-4"
    >
      <ReportsViewSkeleton />
    </LoadingRegion>
  )
}
