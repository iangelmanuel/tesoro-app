import { LoadingRegion } from "@/components/ui/skeleton"
import { RecurringViewSkeleton } from "@/features/recurring-expenses/components/recurring-view"

// Carga de Gastos fijos: los skeletons de la pantalla, con su mismo contenedor
export default function RecurringLoading() {
  return (
    <LoadingRegion
      label="Cargando gastos fijos…"
      className="flex flex-1 flex-col gap-6"
    >
      <RecurringViewSkeleton />
    </LoadingRegion>
  )
}
