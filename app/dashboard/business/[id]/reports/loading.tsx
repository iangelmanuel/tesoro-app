import { LoadingRegion } from "@/components/ui/skeleton"
import { ReportsViewSkeleton } from "@/features/reports/components/reports-view"

// Carga de Reportes de Empresa: los skeletons de la pantalla
export default function BusinessReportsLoading() {
  return (
    <LoadingRegion
      label="Cargando reportes…"
      className="flex flex-1 flex-col gap-6"
    >
      <ReportsViewSkeleton />
    </LoadingRegion>
  )
}
