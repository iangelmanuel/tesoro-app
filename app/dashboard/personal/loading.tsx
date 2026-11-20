import { LoadingRegion } from "@/components/ui/skeleton"
import { SummarySkeleton } from "@/features/reports/components/summary-skeleton"

// Carga del Resumen: el skeleton de cada tarjeta, con su mismo contenedor
export default function SummaryLoading() {
  return (
    <LoadingRegion
      label="Cargando resumen…"
      className="flex flex-1 flex-col gap-4"
    >
      <SummarySkeleton />
    </LoadingRegion>
  )
}
