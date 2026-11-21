import { LoadingRegion } from "@/components/ui/skeleton"
import { AgentsScreenSkeleton } from "@/features/account/components/account-screen-skeletons"

// Carga de Cuenta › Agentes IA: los skeletons de la sección, con su mismo
// contenedor
export default function AccountAgentsLoading() {
  return (
    <LoadingRegion
      label="Cargando agentes…"
      className="flex flex-col gap-6"
    >
      <AgentsScreenSkeleton />
    </LoadingRegion>
  )
}
