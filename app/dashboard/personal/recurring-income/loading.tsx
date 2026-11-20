import { LoadingRegion } from "@/components/ui/skeleton"
import { RecurringIncomeViewSkeleton } from "@/features/recurring-incomes/components/recurring-income-view"

// Carga de Ingresos fijos: los skeletons de la pantalla, con su mismo
// contenedor
export default function RecurringIncomeLoading() {
  return (
    <LoadingRegion
      label="Cargando ingresos fijos…"
      className="flex flex-1 flex-col gap-6"
    >
      <RecurringIncomeViewSkeleton />
    </LoadingRegion>
  )
}
