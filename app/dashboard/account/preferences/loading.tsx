import { LoadingRegion } from "@/components/ui/skeleton"
import { PreferencesScreenSkeleton } from "@/features/account/components/account-screen-skeletons"

// Carga de Cuenta › Preferencias: los skeletons de la sección, con su mismo
// contenedor
export default function AccountPreferencesLoading() {
  return (
    <LoadingRegion
      label="Cargando preferencias…"
      className="flex flex-col gap-6"
    >
      <PreferencesScreenSkeleton />
    </LoadingRegion>
  )
}
