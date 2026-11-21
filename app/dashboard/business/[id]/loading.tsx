import { LoadingRegion } from "@/components/ui/skeleton"
import { BusinessSummarySkeleton } from "@/features/business/components/business-summary-skeleton"

// Carga del Resumen de Empresa: los skeletons de la pantalla, con su mismo
// contenedor
export default function BusinessSummaryLoading() {
  return (
    <LoadingRegion
      label="Cargando resumen…"
      className="flex flex-1 flex-col gap-6"
    >
      <BusinessSummarySkeleton />
    </LoadingRegion>
  )
}
