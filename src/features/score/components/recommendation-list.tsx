import type { Recommendation } from "../types"
import { RecommendationItem } from "./recommendation-item"

interface RecommendationListProps {
  /** Ya ordenadas por severidad y monto */
  recommendations: Recommendation[]
  compact?: boolean
}

export function RecommendationList({
  recommendations,
  compact
}: RecommendationListProps) {
  return (
    <ul className="flex flex-col divide-y">
      {recommendations.map((item) => (
        <RecommendationItem
          key={`${item.rule}:${item.entityKey}`}
          recommendation={item}
          compact={compact}
        />
      ))}
    </ul>
  )
}
