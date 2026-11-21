import { LoadingRegion } from "@/components/ui/skeleton"
import { CashFlowScreenSkeleton } from "@/features/cash-flow/components/cash-flow-screen-skeleton"

// Carga de Flujo de caja: los skeletons de la pantalla, con su mismo
// contenedor
export default function CashFlowLoading() {
  return (
    <LoadingRegion
      label="Cargando flujo de caja…"
      className="flex flex-1 flex-col gap-6"
    >
      <CashFlowScreenSkeleton />
    </LoadingRegion>
  )
}
