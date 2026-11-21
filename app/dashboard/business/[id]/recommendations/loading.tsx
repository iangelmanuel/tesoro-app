import { LoadingRegion } from "@/components/ui/skeleton"
import { ScoreRecommendationsSkeleton } from "@/features/score/components/score-recommendations-view"

// Carga de Recomendaciones de Empresa: los skeletons de la pantalla
export default function BusinessRecommendationsLoading() {
  return (
    <LoadingRegion
      label="Cargando recomendaciones…"
      className="flex flex-1 flex-col gap-6"
    >
      <ScoreRecommendationsSkeleton />
    </LoadingRegion>
  )
}
