import { LoadingRegion } from "@/components/ui/skeleton"
import { SecurityScreenSkeleton } from "@/features/account/components/account-screen-skeletons"

// Carga de Cuenta › Seguridad: los skeletons de la sección, con su mismo
// contenedor
export default function AccountSecurityLoading() {
  return (
    <LoadingRegion
      label="Cargando seguridad…"
      className="flex flex-col gap-6"
    >
      <SecurityScreenSkeleton />
    </LoadingRegion>
  )
}
