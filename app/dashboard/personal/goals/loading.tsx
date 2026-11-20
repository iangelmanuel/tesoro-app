import { LoadingRegion } from "@/components/ui/skeleton"
import { GoalsScreenSkeleton } from "@/features/goals/components/goals-screen-skeleton"

// Carga de Metas: los skeletons de la pantalla, con su mismo contenedor
export default function GoalsLoading() {
  return (
    <LoadingRegion
      label="Cargando metas…"
      className="flex flex-1 flex-col gap-6"
    >
      <GoalsScreenSkeleton />
    </LoadingRegion>
  )
}
