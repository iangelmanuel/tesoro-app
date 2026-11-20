import { LoadingRegion } from "@/components/ui/skeleton"
import { ScoreRecommendationsSkeleton } from "@/features/score/components/score-recommendations-view"

// Carga de Recomendaciones: los skeletons de la pantalla, con su mismo
// contenedor
export default function RecommendationsLoading() {
  return (
    <LoadingRegion
      label="Cargando recomendaciones…"
      className="flex flex-1 flex-col gap-6"
    >
      <ScoreRecommendationsSkeleton />
    </LoadingRegion>
  )
}
