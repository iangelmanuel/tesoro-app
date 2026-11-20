import { LoadingRegion } from "@/components/ui/skeleton"
import { TransactionsScreenSkeleton } from "@/features/transactions/components/transactions-screen-skeleton"

// Carga de Movimientos: los skeletons de la pantalla, con su mismo contenedor
export default function TransactionsLoading() {
  return (
    <LoadingRegion
      label="Cargando movimientos…"
      className="flex flex-1 flex-col gap-4"
    >
      <TransactionsScreenSkeleton />
    </LoadingRegion>
  )
}
