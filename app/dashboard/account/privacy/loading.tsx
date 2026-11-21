import { LoadingRegion } from "@/components/ui/skeleton"
import { PrivacyScreenSkeleton } from "@/features/account/components/account-screen-skeletons"

// Carga de Cuenta › Privacidad: los skeletons de la sección, con su mismo
// contenedor
export default function AccountPrivacyLoading() {
  return (
    <LoadingRegion
      label="Cargando privacidad…"
      className="flex flex-col gap-6"
    >
      <PrivacyScreenSkeleton />
    </LoadingRegion>
  )
}
