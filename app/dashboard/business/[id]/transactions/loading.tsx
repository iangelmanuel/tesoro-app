import { LoadingRegion } from "@/components/ui/skeleton"
import { TransactionsScreenSkeleton } from "@/features/transactions/components/transactions-screen-skeleton"

// Carga de Movimientos de Empresa: los skeletons de la pantalla, con su
// mismo contenedor
export default function BusinessTransactionsLoading() {
  return (
    <LoadingRegion
      label="Cargando movimientos…"
      className="flex flex-1 flex-col gap-6"
    >
      <TransactionsScreenSkeleton
        workspaceType="business"
        createButton
      />
    </LoadingRegion>
  )
}
