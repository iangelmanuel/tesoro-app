import { LoadingRegion } from "@/components/ui/skeleton"
import { DebtsScreenSkeleton } from "@/features/debts/components/debts-screen-skeleton"

// Carga de Deudas: los skeletons de la pantalla, con su mismo contenedor
export default function DebtsLoading() {
  return (
    <LoadingRegion
      label="Cargando deudas…"
      className="flex flex-1 flex-col gap-6"
    >
      <DebtsScreenSkeleton />
    </LoadingRegion>
  )
}
