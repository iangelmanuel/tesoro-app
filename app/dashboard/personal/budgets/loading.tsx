import { LoadingRegion } from "@/components/ui/skeleton"
import { BudgetsScreenSkeleton } from "@/features/budgets/components/budgets-screen-skeleton"

// Carga de Presupuestos: los skeletons de la pantalla, con su mismo contenedor
export default function BudgetsLoading() {
  return (
    <LoadingRegion
      label="Cargando presupuestos…"
      className="flex flex-1 flex-col gap-6"
    >
      <BudgetsScreenSkeleton />
    </LoadingRegion>
  )
}
