import { LoadingRegion } from "@/components/ui/skeleton"
import { GeneralScreenSkeleton } from "@/features/account/components/account-screen-skeletons"

// Carga de Cuenta › General: los skeletons de la sección, con su mismo
// contenedor
export default function AccountGeneralLoading() {
  return (
    <LoadingRegion
      label="Cargando tu perfil…"
      className="flex flex-col gap-6"
    >
      <GeneralScreenSkeleton />
    </LoadingRegion>
  )
}
