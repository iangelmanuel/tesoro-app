import { LoadingRegion } from "@/components/ui/skeleton"
import { AccountsScreenSkeleton } from "@/features/accounts/components/accounts-grid"

// Carga de Cuentas de Empresa: los skeletons de la pantalla, con su mismo
// contenedor
export default function BusinessAccountsLoading() {
  return (
    <LoadingRegion
      label="Cargando cuentas…"
      className="flex flex-1 flex-col gap-6"
    >
      <AccountsScreenSkeleton />
    </LoadingRegion>
  )
}
