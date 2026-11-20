import { LoadingRegion } from "@/components/ui/skeleton"
import { ImportHeader } from "@/features/imports/components/import-header"
import { ImportHistorySkeleton } from "@/features/imports/components/import-history"
import { ImportWizardSkeleton } from "@/features/imports/components/import-wizard"

// Carga de Importar: la cabecera (estática) y los skeletons del asistente y
// el historial, con el mismo contenedor que la página
export default function ImportLoading() {
  return (
    <LoadingRegion
      label="Cargando importar…"
      className="flex flex-1 flex-col gap-6"
    >
      <ImportHeader />
      <ImportWizardSkeleton />
      <ImportHistorySkeleton />
    </LoadingRegion>
  )
}
