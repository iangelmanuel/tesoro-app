import { LoadingRegion } from "@/components/ui/skeleton"
import { BusinessSettingsSkeleton } from "@/features/business/components/business-settings-skeleton"

// Carga de Ajustes de Empresa: las dos secciones
export default function BusinessSettingsLoading() {
  return (
    <LoadingRegion
      label="Cargando ajustes…"
      className="flex flex-1 flex-col gap-6"
    >
      <BusinessSettingsSkeleton />
    </LoadingRegion>
  )
}
